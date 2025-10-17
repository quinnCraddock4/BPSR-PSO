# VPN Compatibility for BPSR-PSO

This document explains the VPN compatibility improvements made to the BPSR-PSO (Blue Protocol: Star Resonance - Per Second Overlay) application.

## Overview

The application has been enhanced to work properly when users have VPN connections active. The main improvements focus on better network interface detection and handling of VPN adapters.

## Changes Made

### 1. Enhanced Network Interface Detection

- **VPN Adapter Recognition**: Added detection for common VPN adapters including OpenVPN, WireGuard, NordVPN, ExpressVPN, Surfshark, ProtonVPN, and others
- **Improved Virtual Interface Handling**: Better distinction between virtual adapters that should be excluded vs. VPN adapters that should be included
- **Smart Interface Scoring**: Implemented a scoring system that prioritizes VPN adapters when they are the active network interface

### 2. Fallback Detection Mechanisms

- **Route Table Analysis**: Enhanced route table parsing to better identify the active network interface
- **Traffic Testing**: Added automatic testing of multiple network interfaces to find the one with actual traffic
- **Multi-Interface Support**: The application now tests up to 5 suitable interfaces to find the best one for packet capture

### 3. Better Error Handling

- **VPN-Specific Error Messages**: Improved error messages that provide guidance when VPN-related issues occur
- **Interface Logging**: Enhanced logging to show which interface is selected and whether it's a VPN interface
- **Address Information**: Display of interface IP addresses to help with troubleshooting

## How It Works

### Interface Detection Process

1. **Route Table Analysis**: First attempts to find the default interface using the system's route table
2. **VPN Adapter Detection**: Identifies VPN adapters and gives them priority in the selection process
3. **Traffic Testing**: Tests multiple suitable interfaces to find the one with actual network traffic
4. **Fallback Selection**: If route-based detection fails, falls back to testing all suitable interfaces

### VPN Adapter Recognition

The application now recognizes these VPN-related keywords:
- `openvpn`, `wireguard`, `nordvpn`, `expressvpn`, `surfshark`, `protonvpn`, `cyberghost`
- `tunnel`, `tun`, `ppp`, `pptp`, `l2tp`, `ipsec`

### Interface Scoring System

Interfaces are scored based on:
- **VPN Adapters**: +100 points (highest priority)
- **Public IP Addresses**: +50 points
- **IPv4 Addresses**: +25 points
- **Number of Addresses**: +10 points per address

## Testing VPN Compatibility

To test if the application works with your VPN:

1. **Run the test script**:
   ```bash
   node test-vpn-detection.js
   ```

2. **Check the output** for:
   - Detection of VPN interfaces
   - Successful interface selection
   - Proper address assignment

3. **Look for these indicators**:
   - `🎉 VPN interface detected - DPS tracking should work with VPN!`
   - Interface addresses showing your VPN's IP range

## Troubleshooting

### Common Issues

1. **"Default network interface not found"**
   - Ensure your VPN is properly connected
   - Try running the application as administrator
   - Check that your VPN adapter is recognized by the system

2. **No traffic detected**
   - Make sure the game is running and connected
   - Verify that the selected interface is the one your game traffic uses
   - Check Windows Firewall settings

3. **Interface selection issues**
   - The application will now test multiple interfaces automatically
   - Check the console output for which interface was selected
   - Verify the interface has valid IP addresses

### VPN-Specific Troubleshooting

- **OpenVPN**: Ensure TAP/TUN adapters are properly installed
- **WireGuard**: Verify the WireGuard service is running
- **Commercial VPNs**: Some VPNs may use split tunneling - ensure game traffic goes through the VPN

## Technical Details

### Files Modified

- `src/services/NetInterfaceService.js`: Enhanced interface detection logic
- `src/services/PacketInterceptor.js`: Improved error handling and logging
- `test-vpn-detection.js`: Test script for verification

### New Functions Added

- `isVpnAdapter()`: Detects VPN adapters
- `isSuitableForCapture()`: Determines if an interface is suitable for packet capture
- `findSuitableDevices()`: Finds and scores suitable interfaces
- `findBestDeviceByTesting()`: Tests multiple interfaces to find the best one

## Compatibility

This update maintains backward compatibility with existing installations while adding VPN support. Users without VPN will see no difference in functionality, while users with VPN will now have proper interface detection.

## Support

If you continue to experience issues with VPN compatibility:

1. Run the test script and share the output
2. Check the application logs for interface selection details
3. Verify your VPN is properly configured and active
4. Ensure the application has the necessary permissions to access network interfaces
