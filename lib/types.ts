export type UserRole = 'admin' | 'course-creator' | 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  studentCount: number;
  teacherId: string;
  teacherName: string;
  status: 'active' | 'completed' | 'upcoming';
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  batchId: string;
  batchName: string;
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
  batchId?: string;
  batchName?: string;
  joinDate?: string;
  specialization?: string;
  batchIds?: string[];
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: 'applied' | 'shortlisted' | 'rejected';
}

export interface Course {
  id: string;
  title: string;
  description: string;
  batchIds: string[];
  status: 'active' | 'completed' | 'upcoming';
}

export interface Lecture {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: string;
  batchId: string;
  batchName: string;
  uploadDate: string;
  order: number;
  courseId: string;
}

export interface ZoomClass {
  id: string;
  title: string;
  batchId: string;
  batchName: string;
  teacherName: string;
  zoomLink: string;
  date: string;
  time: string;
  duration: string;
  status: 'upcoming' | 'live' | 'completed';
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'internship' | 'remote';
  salary: string;
  description: string;
  requirements: string[];
  postedDate: string;
  deadline: string;
}

export interface CurriculumModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  topics: string[];
}

export type MaterialFileType = 'pdf' | 'excel' | 'word' | 'pptx' | 'image' | 'archive' | 'other';

export interface CourseMaterial {
  id: string;
  batchId: string;
  batchName: string;
  courseId?: string;
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  fileType: MaterialFileType;
  fileSize: string;
  uploadDate: string;
  uploadedBy: string;
  uploadedByRole: 'course-creator' | 'teacher';
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}
