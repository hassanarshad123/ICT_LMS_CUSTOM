export interface AnnouncementOut {
  id: string;
  title: string;
  content: string;
  scope: string;
  batchId?: string;
  courseId?: string;
  postedByName?: string;
  expiresAt?: string;
  createdAt?: string;
}
