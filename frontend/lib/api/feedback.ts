import { apiClient } from './client';

// ── Types ──

export type FeedbackType = 'bug_report' | 'feature_request' | 'general_feedback' | 'ux_issue';
export type FeedbackStatus = 'submitted' | 'under_review' | 'planned' | 'in_progress' | 'done' | 'declined';

export interface FeedbackAttachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize?: number;
  viewUrl?: string;
}

export interface FeedbackResponseItem {
  id: string;
  feedbackId: string;
  responderId: string;
  responderName?: string;
  message: string;
  isInternal: boolean;
  createdAt?: string;
}

export interface FeedbackItem {
  id: string;
  feedbackType: FeedbackType;
  subject: string;
  description: string;
  rating?: number;
  status: FeedbackStatus;
  isAnonymous: boolean;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  instituteId?: string;
  instituteName?: string;
  clientContext?: Record<string, unknown>;
  attachments: FeedbackAttachment[];
  responses: FeedbackResponseItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FeedbackListItem {
  id: string;
  feedbackType: FeedbackType;
  subject: string;
  rating?: number;
  status: FeedbackStatus;
  isAnonymous: boolean;
  userName?: string;
  userRole?: string;
  instituteId?: string;
  instituteName?: string;
  attachmentCount: number;
  responseCount: number;
  createdAt?: string;
}

export interface PaginatedFeedback {
  data: FeedbackListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface FeedbackStats {
  totalCount: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byInstitute: { instituteId: string; name: string; count: number }[];
  avgRating?: number;
  ratingDistribution: Record<number, number>;
  unresolvedCount: number;
  avgResponseTimeHours?: number;
  satisfactionTrend: { date: string; avgRating?: number; count: number }[];
  volumeTrend: { date: string; count: number }[];
  topFeatureRequests: { subject: string; count: number }[];
}

// ── API Functions ──

export async function getUploadUrl(fileName: string, contentType: string, fileSize?: number) {
  return apiClient<{ uploadUrl: string; objectKey: string }>('/feedback/upload-url', {
    method: 'POST',
    body: JSON.stringify({ fileName, contentType, fileSize }),
  });
}

export async function submitFeedback(data: {
  feedbackType: string;
  subject: string;
  description: string;
  rating?: number;
  isAnonymous?: boolean;
  clientContext?: Record<string, unknown>;
  attachmentKeys?: string[];
  attachmentNames?: string[];
  attachmentContentTypes?: string[];
  attachmentSizes?: number[];
}) {
  return apiClient<FeedbackItem>('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listFeedback(params?: {
  page?: number;
  per_page?: number;
  feedback_type?: string;
  status?: string;
  institute_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  rating?: number;
}): Promise<PaginatedFeedback> {
  return apiClient('/feedback', { params: params as Record<string, string | number | undefined> });
}

export async function getFeedbackDetail(id: string): Promise<FeedbackItem> {
  return apiClient(`/feedback/${id}`);
}

export async function updateFeedbackStatus(id: string, status: string) {
  return apiClient<FeedbackItem>(`/feedback/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function addFeedbackResponse(id: string, message: string, isInternal: boolean = false) {
  return apiClient<FeedbackResponseItem>(`/feedback/${id}/responses`, {
    method: 'POST',
    body: JSON.stringify({ message, isInternal }),
  });
}

export async function deleteFeedback(id: string) {
  return apiClient(`/feedback/${id}`, { method: 'DELETE' });
}

export async function getFeedbackAnalytics(period: number = 30): Promise<FeedbackStats> {
  return apiClient(`/feedback/analytics`, { params: { period } });
}
