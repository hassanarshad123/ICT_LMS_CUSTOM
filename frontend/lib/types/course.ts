export interface Course {
  id: string;
  title: string;
  description: string;
  batchIds: string[];
  status: 'active' | 'completed' | 'upcoming';
  // Present on student course listings when the row represents a
  // specific (course, student-batch) pair. A student enrolled in two
  // batches of the same course receives two entries, one per batch.
  batchId?: string;
  batchName?: string;
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
