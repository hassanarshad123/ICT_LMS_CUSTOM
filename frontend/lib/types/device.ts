export interface DeviceSession {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  loggedInAt: string;
  lastActiveAt: string;
  isActive: boolean;
}

export interface UserDeviceSummary {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'student' | 'teacher' | 'course-creator';
  activeSessions: DeviceSession[];
}
