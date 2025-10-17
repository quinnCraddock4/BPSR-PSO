import { exec } from 'child_process';
import cap from 'cap';

// Updated keywords to better handle VPN and virtual interfaces
const VIRTUAL_KEYWORDS = ['zerotier', 'vmware', 'hyper-v', 'virtual', 'loopback', 'tap', 'bluetooth', 'wan miniport'];
const VPN_KEYWORDS = ['openvpn', 'wireguard', 'nordvpn', 'expressvpn', 'surfshark', 'protonvpn', 'cyberghost', 'tunnel', 'tun', 'ppp', 'pptp', 'l2tp', 'ipsec'];
const EXCLUDED_KEYWORDS = ['microsoft', 'teredo', 'isatap', '6to4', 'teredo tunneling'];

/**
 * Checks if a network adapter is virtual based on its name.
 * @param {string} name The description or name of the network device.
 * @returns {boolean} True if the device name indicates it's a virtual adapter.
 */
function isVirtual(name) {
    const lower = name.toLowerCase();
    return VIRTUAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Checks if a network adapter is a VPN adapter.
 * @param {string} name The description or name of the network device.
 * @returns {boolean} True if the device name indicates it's a VPN adapter.
 */
function isVpnAdapter(name) {
    const lower = name.toLowerCase();
    return VPN_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Checks if a network adapter should be excluded from consideration.
 * @param {string} name The description or name of the network device.
 * @returns {boolean} True if the device should be excluded.
 */
function isExcluded(name) {
    const lower = name.toLowerCase();
    return EXCLUDED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Checks if a network adapter is suitable for packet capture.
 * @param {string} name The description or name of the network device.
 * @param {Object} device The device object containing addresses.
 * @returns {boolean} True if the device is suitable for packet capture.
 */
function isSuitableForCapture(name, device) {
    // Exclude obviously unsuitable adapters
    if (isExcluded(name)) {
        return false;
    }
    
    // Include VPN adapters as they might be the active interface
    if (isVpnAdapter(name)) {
        return true;
    }
    
    // Exclude virtual adapters that are not VPN
    if (isVirtual(name) && !isVpnAdapter(name)) {
        return false;
    }
    
    // Check if device has valid addresses
    if (!device.addresses || device.addresses.length === 0) {
        return false;
    }
    
    // Check for valid IP addresses
    const hasValidAddress = device.addresses.some(addr => 
        addr.addr && 
        addr.addr !== '127.0.0.1' && 
        addr.addr !== '::1' &&
        !addr.addr.startsWith('169.254.') // Link-local addresses
    );
    
    return hasValidAddress;
}

/**
 * Detects TCP traffic on a network adapter for 3 seconds.
 * @param {number} deviceIndex The index of the device.
 * @param {Object} devices A map of network devices.
 * @returns {Promise<number>} A promise that resolves with the number of packets detected.
 */
export function detectTraffic(deviceIndex, devices) {
    return new Promise((resolve) => {
        let count = 0;
        let c;

        const cleanup = () => {
            if (c) {
                try {
                    c.close();
                } catch (e) {
                    console.error('Error closing capture device:', e);
                }
            }
        };

        const timeoutId = setTimeout(() => {
            cleanup();
            resolve(count);
        }, 3000);

        try {
            // Check if the device exists before proceeding
            if (!devices[deviceIndex] || !devices[deviceIndex].name) {
                console.error(`Invalid device index: ${deviceIndex}`);
                clearTimeout(timeoutId);
                resolve(0);
                return;
            }

            c = new cap.Cap();
            const buffer = Buffer.alloc(65535);

            console.log(`Attempting to open device: ${devices[deviceIndex].name}`);
            const openResult = c.open(devices[deviceIndex].name, 'ip and tcp', 1024 * 1024, buffer);
            console.log(`Open result for ${devices[deviceIndex].name}: ${openResult}`);

            if (openResult) {
                // Check if open was successful (returns a string on success)
                try {
                    c.on('packet', () => {
                        try {
                            count++;
                        } catch (e) {
                            console.error('An error occurred inside the packet handler:', e);
                        }
                    });
                    console.log('in');
                } catch (e) {
                    console.error(`Failed to attach packet listener to device ${devices[deviceIndex].name}:`, e);
                    cleanup();
                    clearTimeout(timeoutId);
                    resolve(0);
                }
            } else {
                console.warn(`Failed to open device ${devices[deviceIndex].name}. Result was:`, openResult);
                cleanup();
                clearTimeout(timeoutId);
                resolve(0);
            }
        } catch (e) {
            console.error(
                `A critical error occurred while attempting to open device ${devices[deviceIndex]?.name || 'N/A'}:`,
                'This may be due to a lack of administrator privileges. Please try running the application as an administrator.',
                e
            );
            cleanup();
            clearTimeout(timeoutId);
            resolve(0);
        }
    });
}

/**
 * Finds the default network device using the system's route table.
 * This function is specifically for Windows.
 * @param {Object} devices A map of network devices.
 * @returns {Promise<number|undefined>} A promise that resolves with the device index or undefined.
 */
export async function findByRoute(devices) {
    try {
        const stdout = await new Promise((resolve, reject) => {
            exec('route print 0.0.0.0', (error, stdout) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });

        // Parse route table to find default gateway
        const lines = stdout.split('\n');
        const defaultRoutes = lines.filter(line => 
            line.trim().startsWith('0.0.0.0') && 
            !line.includes('On-Link') &&
            !line.includes('::')
        );

        if (defaultRoutes.length === 0) {
            console.log('No default routes found in route table');
            return undefined;
        }

        // Get the first valid default route
        const defaultRoute = defaultRoutes[0].trim().split(/\s+/);
        const defaultInterface = defaultRoute[3];

        if (!defaultInterface) {
            console.log('No default interface found in route table');
            return undefined;
        }

        console.log(`Found default interface from route table: ${defaultInterface}`);

        // Find the device that matches this interface
        const targetInterface = Object.keys(devices).find((key) => {
            const device = devices[key];
            if (!device.addresses) return false;
            
            return device.addresses.some((address) => address.addr === defaultInterface);
        });

        if (!targetInterface) {
            console.log(`Could not find device for interface ${defaultInterface}`);
            return undefined;
        }

        const deviceIndex = parseInt(targetInterface, 10);
        const device = devices[deviceIndex];
        console.log(`Matched device: ${deviceIndex} - ${device.description}`);
        
        return deviceIndex;
    } catch (error) {
        console.error('Failed to find device by route:', error);
        return undefined;
    }
}

/**
 * Finds suitable network devices by analyzing their characteristics.
 * @param {Object} devices A map of network devices.
 * @returns {Array} Array of suitable device indices with scores.
 */
export function findSuitableDevices(devices) {
    const suitableDevices = [];
    
    Object.keys(devices).forEach(key => {
        const deviceIndex = parseInt(key, 10);
        const device = devices[deviceIndex];
        const name = device.description || device.name || '';
        
        if (!isSuitableForCapture(name, device)) {
            return;
        }
        
        let score = 0;
        
        // Prefer VPN adapters when they exist
        if (isVpnAdapter(name)) {
            score += 100;
            console.log(`VPN adapter detected: ${deviceIndex} - ${name}`);
        }
        
        // Prefer adapters with more addresses (more likely to be active)
        if (device.addresses) {
            score += device.addresses.length * 10;
        }
        
        // Prefer adapters with public IP addresses
        const hasPublicIP = device.addresses && device.addresses.some(addr => 
            addr.addr && 
            !addr.addr.startsWith('192.168.') &&
            !addr.addr.startsWith('10.') &&
            !addr.addr.startsWith('172.') &&
            !addr.addr.startsWith('127.') &&
            !addr.addr.startsWith('169.254.')
        );
        
        if (hasPublicIP) {
            score += 50;
        }
        
        // Prefer adapters with IPv4 addresses
        const hasIPv4 = device.addresses && device.addresses.some(addr => 
            addr.addr && !addr.addr.includes(':')
        );
        
        if (hasIPv4) {
            score += 25;
        }
        
        suitableDevices.push({ index: deviceIndex, score, device, name });
    });
    
    // Sort by score (highest first)
    suitableDevices.sort((a, b) => b.score - a.score);
    
    return suitableDevices;
}

/**
 * Tests multiple network devices to find the best one for packet capture.
 * @param {Object} devices A map of network devices.
 * @returns {Promise<number|undefined>} The index of the best network device.
 */
export async function findBestDeviceByTesting(devices) {
    console.log('Testing multiple network devices to find the best one...');
    
    const suitableDevices = findSuitableDevices(devices);
    
    if (suitableDevices.length === 0) {
        console.log('No suitable devices found for packet capture');
        return undefined;
    }
    
    console.log(`Found ${suitableDevices.length} suitable devices, testing traffic detection...`);
    
    // Test up to 5 devices with the highest scores
    const devicesToTest = suitableDevices.slice(0, 5);
    const testResults = [];
    
    for (const { index, score, name } of devicesToTest) {
        console.log(`Testing device ${index} (score: ${score}): ${name}`);
        
        try {
            const trafficCount = await detectTraffic(index, devices);
            testResults.push({ index, score, trafficCount, name });
            console.log(`Device ${index} detected ${trafficCount} packets`);
        } catch (error) {
            console.log(`Device ${index} failed testing: ${error.message}`);
        }
    }
    
    // Sort by traffic count (highest first), then by score
    testResults.sort((a, b) => {
        if (b.trafficCount !== a.trafficCount) {
            return b.trafficCount - a.trafficCount;
        }
        return b.score - a.score;
    });
    
    if (testResults.length > 0) {
        const bestDevice = testResults[0];
        console.log(`Selected device ${bestDevice.index} with ${bestDevice.trafficCount} packets detected`);
        return bestDevice.index;
    }
    
    return undefined;
}

/**
 * Finds the most suitable default network device by using the system's route table.
 * @param {Object} devices A map of network devices.
 * @returns {Promise<number|undefined>} The index of the default network device.
 */
export async function findDefaultNetworkDevice(devices) {
    console.log('Auto detecting default network interface...');
    
    try {
        // First, try to find by route table
        console.log('Attempting to find interface via route table...');
        const routeIndex = await findByRoute(devices);

        if (routeIndex !== undefined) {
            const device = devices[routeIndex];
            console.log(`Using adapter from route table: ${routeIndex} - ${device.description}`);
            
            // Test if this device actually works
            try {
                const trafficCount = await detectTraffic(routeIndex, devices);
                console.log(`Route-based device ${routeIndex} detected ${trafficCount} packets`);
                if (trafficCount > 0) {
                    return routeIndex;
                }
            } catch (error) {
                console.log(`Route-based device ${routeIndex} failed testing: ${error.message}`);
            }
        }
        
        console.log('Route-based detection failed or device not suitable, trying fallback methods...');
        
        // Fallback: Test all suitable devices
        const bestDevice = await findBestDeviceByTesting(devices);
        
        if (bestDevice !== undefined) {
            console.log(`Using best available device: ${bestDevice} - ${devices[bestDevice].description}`);
            return bestDevice;
        }
        
        console.log('Could not find a suitable network interface.');
        return undefined;
        
    } catch (error) {
        console.error(
            'An error occurred during device lookup. Please ensure your system is properly configured.',
            error
        );
        return undefined;
    }
}
