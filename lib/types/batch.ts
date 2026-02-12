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
