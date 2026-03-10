export interface MaterialOut {
  id: string;
  batchId: string;
  courseId?: string;
  title: string;
  description?: string;
  fileName: string;
  fileType: string;
  fileSize?: string;
  fileSizeBytes?: number;
  uploadDate?: string;
  uploadedByName?: string;
}
