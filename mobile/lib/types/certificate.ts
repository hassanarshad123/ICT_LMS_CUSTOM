export interface CertificateOut {
  id: string;
  studentId: string;
  studentName: string;
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  certificateId?: string;
  verificationCode?: string;
  certificateName?: string;
  status: string;
  completionPercentage: number;
  issuedAt?: string;
  createdAt?: string;
}

export interface StudentDashboardCourse {
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  completionPercentage: number;
  threshold: number;
  status: 'not_started' | 'in_progress' | 'eligible' | 'pending' | 'approved' | 'revoked';
  certificateId?: string;
  certificateName?: string;
  issuedAt?: string;
}
