'use client';

import { useState } from 'react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getStudentDashboard,
  downloadCertificate,
  requestCertificate,
  StudentDashboardCourse,
} from '@/lib/api/certificates';
import { useAuth } from '@/lib/auth-context';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { Award, Download, Loader2, BookOpen, Clock, CheckCircle2, XCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-500', bg: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-50' },
  eligible: { label: 'Eligible for Certificate', color: 'text-green-600', bg: 'bg-green-50' },
  pending: { label: 'Pending Approval', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  approved: { label: 'Certificate Issued', color: 'text-green-700', bg: 'bg-green-100' },
  revoked: { label: 'Certificate Revoked', color: 'text-red-600', bg: 'bg-red-50' },
};

function ProgressBar({ percentage, threshold }: { percentage: number; threshold: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-gray-600">{percentage}% complete</span>
        <span className="text-gray-400">Threshold: {threshold}%</span>
      </div>
      <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percentage >= threshold ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-400"
          style={{ left: `${Math.min(threshold, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function StudentCertificates() {
  const { user } = useAuth();
  const { data: courses, loading, error, refetch } = useApi(getStudentDashboard);
  const { execute: doDownload } = useMutation(downloadCertificate);
  const { execute: doRequest, loading: requesting } = useMutation(requestCertificate);

  const [requestDialog, setRequestDialog] = useState<StudentDashboardCourse | null>(null);
  const [certName, setCertName] = useState('');

  const openRequestDialog = (course: StudentDashboardCourse) => {
    setRequestDialog(course);
    setCertName(user?.name || '');
  };

  const handleRequest = async () => {
    if (!requestDialog || !certName.trim()) return;
    try {
      await doRequest(requestDialog.batchId, requestDialog.courseId, certName.trim());
      toast.success('Certificate requested successfully!');
      setRequestDialog(null);
      setCertName('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to request certificate');
    }
  };

  const handleDownload = async (course: StudentDashboardCourse) => {
    if (!course.certificateId) return;
    try {
      const res = await doDownload(course.certificateId);
      window.open(res.downloadUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download certificate');
    }
  };

  if (loading) return <PageLoading variant="cards" />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  if (!courses || courses.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={28} className="text-gray-400" />}
        title="No Courses Found"
        description="You are not enrolled in any courses yet. Contact your administrator for enrollment."
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">My Certificates</h1>
        <p className="text-sm text-gray-500 mt-1">Track your progress and request certificates for completed courses</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {courses.map((course) => {
          const config = statusConfig[course.status] || statusConfig.not_started;

          return (
            <div key={`${course.batchId}-${course.courseId}`} className="bg-white rounded-2xl p-5 card-shadow flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-[#F5F5F5] rounded-xl flex items-center justify-center flex-shrink-0">
                  {course.status === 'approved' ? (
                    <Award size={20} className="text-green-600" />
                  ) : course.status === 'revoked' ? (
                    <XCircle size={20} className="text-red-500" />
                  ) : (
                    <BookOpen size={20} className="text-[#1A1A1A]" />
                  )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bg}`}>
                  {course.status === 'in_progress' ? `In Progress (${course.completionPercentage}%)` : config.label}
                </span>
              </div>

              {/* Course info */}
              <h3 className="font-semibold text-[#1A1A1A] mb-1 line-clamp-2">{course.courseTitle}</h3>
              <p className="text-xs text-gray-500 mb-1">{course.batchName}</p>

              {/* Progress bar */}
              <ProgressBar percentage={course.completionPercentage} threshold={course.threshold} />

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action area */}
              <div className="mt-4">
                {course.status === 'eligible' && (
                  <button
                    onClick={() => openRequestDialog(course)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C5D86D] text-[#1A1A1A] rounded-xl text-sm font-medium hover:bg-[#b8cc5c] transition-colors"
                  >
                    <Send size={16} />
                    Request Certificate
                  </button>
                )}

                {course.status === 'pending' && (
                  <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-50 text-yellow-700 rounded-xl text-sm font-medium">
                    <Clock size={16} />
                    Awaiting Approval
                  </div>
                )}

                {course.status === 'approved' && (
                  <>
                    {course.issuedAt && (
                      <p className="text-xs text-gray-400 mb-2 text-center">
                        Issued {new Date(course.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                    <button
                      onClick={() => handleDownload(course)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                    >
                      <Download size={16} />
                      Download Certificate
                    </button>
                  </>
                )}

                {course.status === 'revoked' && (
                  <p className="text-xs text-red-500 text-center py-2">
                    This certificate has been revoked
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Request Certificate Dialog */}
      <Dialog open={!!requestDialog} onOpenChange={(open) => { if (!open) { setRequestDialog(null); setCertName(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Certificate</DialogTitle>
            <DialogDescription>
              Enter the name you&apos;d like to appear on your certificate for <strong>{requestDialog?.courseTitle}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Name on Certificate</label>
              <input
                type="text"
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50"
                autoFocus
              />
            </div>

            {/* Preview */}
            {certName.trim() && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest text-center mb-1">Certificate Preview</p>
                <p className="text-xs text-gray-400 text-center mb-3">This is to certify that</p>
                <p className="text-xl font-serif font-semibold text-[#1A1A1A] text-center mb-3">{certName.trim()}</p>
                <p className="text-xs text-gray-400 text-center">
                  has successfully completed <span className="font-medium text-gray-600">{requestDialog?.courseTitle}</span>
                </p>
              </div>
            )}

            <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
              This name will appear on your certificate and cannot be changed after issuance.
            </p>
          </div>

          <DialogFooter>
            <button
              onClick={() => { setRequestDialog(null); setCertName(''); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRequest}
              disabled={!certName.trim() || requesting}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60"
            >
              {requesting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Request Certificate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
