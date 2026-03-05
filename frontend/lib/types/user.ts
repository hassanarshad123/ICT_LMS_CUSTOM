export type UserRole = 'admin' | 'course-creator' | 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  batchIds: string[];
  batchNames: string[];
  joinDate: string;
  status: 'active' | 'inactive';
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  batchIds: string[];
  status: 'active' | 'inactive';
}

export interface CourseCreator {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
}

export interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'student' | 'teacher' | 'course-creator';
  status: 'active' | 'inactive';
  batchIds?: string[];
  batchNames?: string[];
  joinDate?: string;
  specialization?: string;
}
