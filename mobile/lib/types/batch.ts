export interface BatchOut {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  teacherId?: string;
  teacherName?: string;
  studentCount: number;
  courseCount: number;
  status: string;
  createdAt?: string;
}
