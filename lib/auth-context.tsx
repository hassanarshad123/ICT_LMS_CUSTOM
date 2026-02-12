'use client';

import { createContext, useContext, ReactNode } from 'react';
import { UserRole } from './types';

interface MockUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  batchId?: string;
  batchName?: string;
  teacherId?: string;
  specialization?: string;
}

const mockUsers: Record<UserRole, MockUser> = {
  admin: {
    id: 'admin1',
    name: 'Admin User',
    email: 'admin@ict.edu.pk',
    phone: '0300-0000000',
    role: 'admin',
  },
  'course-creator': {
    id: 'cc1',
    name: 'Asad Mehmood',
    email: 'asad@ict.edu.pk',
    phone: '0300-4444444',
    role: 'course-creator',
  },
  teacher: {
    id: 't1',
    name: 'Ahmed Khan',
    email: 'ahmed@ict.edu.pk',
    phone: '0300-1111111',
    role: 'teacher',
    teacherId: 't1',
    specialization: 'Web Development',
  },
  student: {
    id: 's1',
    name: 'Muhammad Imran',
    email: 'imran@email.com',
    phone: '0300-1234567',
    role: 'student',
    batchId: 'b3',
    batchName: 'Batch 3 - August 2024',
  },
};

const AuthContext = createContext<MockUser | null>(null);

interface AuthProviderProps {
  role: UserRole;
  children: ReactNode;
}

export function AuthProvider({ role, children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={mockUsers[role]}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): MockUser {
  const user = useContext(AuthContext);
  if (!user) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return user;
}
