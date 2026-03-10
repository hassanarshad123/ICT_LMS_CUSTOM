export interface ZoomClassOut {
  id: string;
  title: string;
  batchId: string;
  batchName?: string;
  teacherId: string;
  teacherName?: string;
  zoomMeetingUrl?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  durationDisplay?: string;
  status: string;
  createdAt?: string;
}

export interface AttendanceItem {
  id: string;
  zoomClassId: string;
  studentId: string;
  studentName?: string;
  attended: boolean;
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number;
}

export interface RecordingItem {
  id: string;
  classTitle: string;
  teacherName?: string;
  batchName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  status: string;
  createdAt?: string;
}
