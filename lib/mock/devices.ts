import { DeviceSession } from '../types';

export const deviceSessions: DeviceSession[] = [
  // s1 — 2 devices (at limit)
  { id: 'ds1', userId: 's1', deviceInfo: 'Chrome on Windows 11', ipAddress: '192.168.1.10', loggedInAt: '2024-10-25T08:30:00', lastActiveAt: '2024-10-28T14:22:00', isActive: true },
  { id: 'ds2', userId: 's1', deviceInfo: 'Safari on iPhone 15', ipAddress: '10.0.0.45', loggedInAt: '2024-10-26T19:15:00', lastActiveAt: '2024-10-28T12:00:00', isActive: true },
  // s2 — 1 device
  { id: 'ds3', userId: 's2', deviceInfo: 'Firefox on macOS Sonoma', ipAddress: '172.16.0.22', loggedInAt: '2024-10-27T10:00:00', lastActiveAt: '2024-10-28T11:45:00', isActive: true },
  // s3 — 0 devices
  // s4 — 2 devices (at limit)
  { id: 'ds4', userId: 's4', deviceInfo: 'Chrome on Android 14', ipAddress: '192.168.2.55', loggedInAt: '2024-10-24T07:20:00', lastActiveAt: '2024-10-28T09:30:00', isActive: true },
  { id: 'ds5', userId: 's4', deviceInfo: 'Edge on Windows 10', ipAddress: '192.168.2.60', loggedInAt: '2024-10-25T16:40:00', lastActiveAt: '2024-10-28T13:15:00', isActive: true },
  // s5 — 1 device
  { id: 'ds6', userId: 's5', deviceInfo: 'Chrome on ChromeOS', ipAddress: '10.10.1.8', loggedInAt: '2024-10-26T14:00:00', lastActiveAt: '2024-10-28T10:20:00', isActive: true },
  // s6 — 0 devices
  // s7 — 2 devices (at limit)
  { id: 'ds7', userId: 's7', deviceInfo: 'Safari on macOS Ventura', ipAddress: '192.168.3.12', loggedInAt: '2024-10-23T11:10:00', lastActiveAt: '2024-10-28T15:00:00', isActive: true },
  { id: 'ds8', userId: 's7', deviceInfo: 'Chrome on iPad Air', ipAddress: '192.168.3.15', loggedInAt: '2024-10-27T08:50:00', lastActiveAt: '2024-10-28T14:30:00', isActive: true },
  // s8 — 1 device
  { id: 'ds9', userId: 's8', deviceInfo: 'Firefox on Ubuntu 22.04', ipAddress: '10.0.5.33', loggedInAt: '2024-10-20T09:00:00', lastActiveAt: '2024-10-25T17:00:00', isActive: true },
  // s9 — 0 devices
  // s10 — 1 device
  { id: 'ds10', userId: 's10', deviceInfo: 'Chrome on Windows 11', ipAddress: '192.168.4.77', loggedInAt: '2024-10-28T06:30:00', lastActiveAt: '2024-10-28T15:10:00', isActive: true },
  // t1 — 2 devices (at limit)
  { id: 'ds11', userId: 't1', deviceInfo: 'Safari on MacBook Pro', ipAddress: '10.1.1.100', loggedInAt: '2024-10-22T07:00:00', lastActiveAt: '2024-10-28T14:50:00', isActive: true },
  { id: 'ds12', userId: 't1', deviceInfo: 'Chrome on Android 13', ipAddress: '10.1.1.105', loggedInAt: '2024-10-26T20:30:00', lastActiveAt: '2024-10-28T08:15:00', isActive: true },
  // t2 — 1 device
  { id: 'ds13', userId: 't2', deviceInfo: 'Edge on Windows 11', ipAddress: '172.20.0.14', loggedInAt: '2024-10-27T08:00:00', lastActiveAt: '2024-10-28T13:40:00', isActive: true },
  // t3 — 0 devices
  // cc1 — 1 device
  { id: 'ds14', userId: 'cc1', deviceInfo: 'Chrome on macOS Sonoma', ipAddress: '192.168.10.5', loggedInAt: '2024-10-25T09:00:00', lastActiveAt: '2024-10-28T15:20:00', isActive: true },
  // cc2 — 2 devices (at limit)
  { id: 'ds15', userId: 'cc2', deviceInfo: 'Firefox on Windows 11', ipAddress: '192.168.10.20', loggedInAt: '2024-10-24T10:30:00', lastActiveAt: '2024-10-28T12:50:00', isActive: true },
  { id: 'ds16', userId: 'cc2', deviceInfo: 'Safari on iPhone 14 Pro', ipAddress: '192.168.10.25', loggedInAt: '2024-10-27T18:00:00', lastActiveAt: '2024-10-28T11:30:00', isActive: true },
];
