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
