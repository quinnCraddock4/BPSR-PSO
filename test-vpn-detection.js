#!/usr/bin/env node

/**
 * Test script to verify VPN detection improvements
 * This script tests the enhanced network interface detection
 */

import cap from 'cap';
import { findDefaultNetworkDevice, findSuitableDevices } from './src/services/NetInterfaceService.js';

console.log('Testing VPN-compatible network interface detection...\n');

try {
    const devices = cap.deviceList();
    console.log(`Found ${Object.keys(devices).length} network devices:\n`);
    
    // List all devices
    Object.keys(devices).forEach(key => {
        const device = devices[key];
        console.log(`Device ${key}: ${device.description || device.name}`);
        if (device.addresses && device.addresses.length > 0) {
            console.log(`  Addresses: ${device.addresses.map(addr => addr.addr).join(', ')}`);
        }
        console.log('');
    });
    
    // Test suitable device detection
    console.log('Testing suitable device detection...');
    const suitableDevices = findSuitableDevices(devices);
    console.log(`Found ${suitableDevices.length} suitable devices:`);
    
    suitableDevices.forEach(({ index, score, name }) => {
        console.log(`  Device ${index} (score: ${score}): ${name}`);
    });
    
    console.log('\nTesting default network device detection...');
    const defaultDevice = await findDefaultNetworkDevice(devices);
    
    if (defaultDevice !== undefined) {
        const device = devices[defaultDevice];
        console.log(`\n✅ Successfully selected device: ${defaultDevice} - ${device.description}`);
        
        // Check if it's a VPN interface
        const isVpnInterface = device.description && (
            device.description.toLowerCase().includes('vpn') ||
            device.description.toLowerCase().includes('tunnel') ||
            device.description.toLowerCase().includes('tun') ||
            device.description.toLowerCase().includes('openvpn') ||
            device.description.toLowerCase().includes('wireguard')
        );
        
        if (isVpnInterface) {
            console.log('🎉 VPN interface detected - DPS tracking should work with VPN!');
        } else {
            console.log('📡 Standard network interface detected');
        }
        
        if (device.addresses && device.addresses.length > 0) {
            console.log(`Interface addresses: ${device.addresses.map(addr => addr.addr).join(', ')}`);
        }
    } else {
        console.log('❌ No suitable network device found');
        console.log('This might indicate an issue with network interface detection');
    }
    
} catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error('Make sure you have the required dependencies installed and run as administrator if needed');
}

console.log('\nTest completed.');
