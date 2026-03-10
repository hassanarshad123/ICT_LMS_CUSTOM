export interface LectureOut {
  id: string;
  title: string;
  description?: string;
  videoType: string;
  videoUrl?: string;
  bunnyVideoId?: string;
  videoStatus?: string;
  duration?: number;
  durationDisplay?: string;
  fileSize?: number;
  batchId: string;
  courseId?: string;
  sequenceOrder: number;
  thumbnailUrl?: string;
  createdAt?: string;
}
