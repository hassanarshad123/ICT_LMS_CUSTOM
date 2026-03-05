import { UnifiedUser, UserDeviceSummary } from '../types';
import { students } from './students';
import { teachers } from './teachers';
import { courseCreators } from './course-creators';
import { deviceSessions } from './devices';

export function getAllUsers(): UnifiedUser[] {
  const studentUsers: UnifiedUser[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: 'student' as const,
    status: s.status,
    batchIds: s.batchIds,
    batchNames: s.batchNames,
    joinDate: s.joinDate,
  }));

  const teacherUsers: UnifiedUser[] = teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    phone: t.phone,
    role: 'teacher' as const,
    status: t.status,
    specialization: t.specialization,
    batchIds: t.batchIds,
  }));

  const ccUsers: UnifiedUser[] = courseCreators.map((cc) => ({
    id: cc.id,
    name: cc.name,
    email: cc.email,
    phone: cc.phone,
    role: 'course-creator' as const,
    status: cc.status,
  }));

  return [...studentUsers, ...teacherUsers, ...ccUsers];
}

export function getUserDeviceSummaries(): UserDeviceSummary[] {
  const allUsers = getAllUsers();
  return allUsers.map((user) => ({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    activeSessions: deviceSessions.filter((ds) => ds.userId === user.id && ds.isActive),
  }));
}
