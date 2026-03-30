import { apiClient } from './client';

// ── Dashboard typed interfaces ──────────────────────────────

export interface RecentBatch {
  id: string;
  name: string;
  startDate: string;
  teacherName: string;
  studentCount: number;
  status: string;
}

export interface RecentStudent {
  id: string;
  name: string;
  email: string;
  status: string;
  batchNames: string[];
}

export interface DashboardData {
  totalBatches: number;
  activeBatches: number;
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalCourseCreators: number;
  totalCourses: number;
  recentBatches: RecentBatch[];
  recentStudents: RecentStudent[];
}

// ── Insights typed interfaces ───────────────────────────────

export interface MonthlyStatItem {
  month: string;
  count: number;
}

export interface BatchEnrollmentItem {
  batchId: string;
  name: string;
  studentCount: number;
}

export interface TeacherWorkloadItem {
  teacherId: string;
  name: string;
  batchCount: number;
  studentCount: number;
}

export interface LecturesPerCourseItem {
  courseId: string;
  title: string;
  lectureCount: number;
}

export interface InsightsData {
  monthly: MonthlyStatItem[];
  studentsByStatus: Record<string, number>;
  batchesByStatus: Record<string, number>;
  enrollmentPerBatch: BatchEnrollmentItem[];
  teacherWorkload: TeacherWorkloadItem[];
  materialsByType: Record<string, number>;
  lecturesPerCourse: LecturesPerCourseItem[];
  deviceOverview: Record<string, number>;
}

export async function getDashboard(): Promise<DashboardData> {
  return apiClient('/admin/dashboard');
}

export async function getInsights(): Promise<InsightsData> {
  return apiClient('/admin/insights');
}

export async function listDevices(params?: {
  role?: string;
  search?: string;
  page?: number;
  per_page?: number;
}) {
  return apiClient('/admin/devices', { params: params as Record<string, string | number | undefined> });
}

export async function terminateSession(sessionId: string): Promise<void> {
  return apiClient(`/admin/devices/${sessionId}`, { method: 'DELETE' });
}

export async function terminateAllUserSessions(userId: string): Promise<void> {
  return apiClient(`/admin/devices/user/${userId}`, { method: 'DELETE' });
}

export async function getSettings(): Promise<{ settings: Record<string, string> }> {
  return apiClient('/admin/settings', { skipConversion: true });
}

export async function updateSettings(settings: Record<string, string>): Promise<{ settings: Record<string, string> }> {
  return apiClient('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
    skipConversion: true,
  });
}

export async function getActivityLog(params?: {
  action?: string;
  entity_type?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}) {
  return apiClient('/admin/activity-log', { params: params as Record<string, string | number | undefined> });
}

export async function exportData(entityType: string, format: string = 'csv') {
  return apiClient(`/admin/export/${entityType}`, { params: { format } });
}

// ── 10x Insights — Tab-based analytics ─────────────────────────

export interface KpiCard {
  value: number;
  previousValue: number;
  changePct: number | null;
  sparkline: { date: string; value: number }[];
}

export interface AlertItem {
  type: string;
  count: number;
  label: string;
  link?: string;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface BatchHealthItem {
  name: string;
  watchCompletion: number;
  attendanceRate: number | null;
}

export interface OverviewData {
  activeStudents: KpiCard;
  activeBatches: KpiCard;
  lectureCompletion: KpiCard;
  quizPassRate: KpiCard;
  classesConducted: KpiCard;
  certificatesIssued: KpiCard;
  avgAttendance: KpiCard;
  contentCreated: KpiCard;
  alerts: AlertItem[];
  enrollmentTrend: TrendPoint[];
  batchStatus: { upcoming: number; active: number; completed: number };
  topBatches: { name: string; studentCount: number }[];
  quizTrend: TrendPoint[];
  batchHealth: BatchHealthItem[];
  lastUpdated: string;
}

export interface AtRiskStudent {
  studentId: string;
  name: string;
  email: string;
  batchName: string;
  watchPct: number;
  quizAvg: number | null;
  lastActive: string | null;
  riskLevel: string;
}

export interface StudentsData {
  studentsByStatus: Record<string, number>;
  enrollmentTrend: { week: string; count: number }[];
  completionDistribution: Record<string, number>;
  quizScoreDistribution: Record<string, number>;
  atRiskStudents: AtRiskStudent[];
  totalStudents: number;
  lastUpdated: string;
}

export interface TeacherPerformance {
  teacherId: string;
  name: string;
  batchesAssigned: number;
  classesConducted: number;
  avgAttendanceRate: number | null;
  studentsManaged: number;
  isIdle: boolean;
}

export interface CreatorActivity {
  creatorId: string;
  name: string;
  coursesCreated: number;
  lecturesUploaded: number;
  materialsAdded: number;
  quizzesCreated: number;
  isIdle: boolean;
}

export interface StaffData {
  teachers: TeacherPerformance[];
  creators: CreatorActivity[];
  idleTeachers: number;
  idleCreators: number;
  lastUpdated: string;
}

export interface CoursePerformance {
  courseId: string;
  title: string;
  lectureCount: number;
  avgWatchPct: number | null;
  quizPassRate: number | null;
  certRequests: number;
}

export interface CoursesData {
  coursePerformance: CoursePerformance[];
  quizPassRate: number;
  quizFailRate: number;
  hardestQuizzes: { quizId: string; title: string; courseTitle: string; avgScore: number; passRate: number; attemptCount: number }[];
  quizTrend: { date: string; attempts: number; passRate: number }[];
  certificatePipeline: { eligible: number; requested: number; approved: number; issued: number };
  lastUpdated: string;
}

export interface EngagementData {
  overallLectureCompletion: number;
  overallAttendanceRate: number | null;
  mostWatched: { lectureId: string; title: string; courseTitle: string; avgWatchPct: number; studentCount: number }[];
  leastWatched: { lectureId: string; title: string; courseTitle: string; avgWatchPct: number; studentCount: number }[];
  engagementByBatch: { batchId: string; batchName: string; watchCompletion: number; attendanceRate: number | null }[];
  engagementTrend: { date: string; watchPct: number; attendancePct: number | null }[];
  lowAttendanceClasses: { classId: string; title: string; batchName: string; date: string; attendanceRate: number }[];
  lastUpdated: string;
}

export async function getInsightsOverview(period: number = 30): Promise<OverviewData> {
  return apiClient('/admin/insights/overview', { params: { period } });
}

export async function getInsightsStudents(period: number = 30): Promise<StudentsData> {
  return apiClient('/admin/insights/students', { params: { period } });
}

export async function getInsightsStaff(period: number = 30): Promise<StaffData> {
  return apiClient('/admin/insights/staff', { params: { period } });
}

export async function getInsightsCourses(period: number = 30): Promise<CoursesData> {
  return apiClient('/admin/insights/courses', { params: { period } });
}

export async function getInsightsEngagement(period: number = 30): Promise<EngagementData> {
  return apiClient('/admin/insights/engagement', { params: { period } });
}
