export interface CourseOut {
  id: string;
  title: string;
  description?: string;
  status: string;
  batchIds: string[];
  createdAt?: string;
}
