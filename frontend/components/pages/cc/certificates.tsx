'use client';

import { useState } from 'react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  listCertificates,
  listCertificateRequests,
  approveCertificateRequest,
  downloadCertificate,
  revokeCertificate,
  CertificateOut,
  EligibleStudentOut,
} from '@/lib/api/certificates';
import { listBatches, BatchOut } from '@/lib/api/batches';
import { listCourses, CourseOut } from '@/lib/api/courses';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { Award, CheckCircle2, Download, XCircle, Loader2, Users, FileCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusBadge: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  revoked: 'bg-red-100 text-red-700',
  eligible: 'bg-yellow-100 text-yellow-700',
};

export default function CCCertificates() {
  const [activeTab, setActiveTab] = useState<'queue' | 'issued'>('queue');

  return (
    <DashboardLayout>
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Certificates</h1>
        <p className="text-sm text-gray-500 mt-1">Review student certificate requests and manage issued ones</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'queue' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users size={16} />
            Certificate Requests
          </span>
        </button>
        <button
          onClick={() => setActiveTab('issued')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'issued' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileCheck size={16} />
            Issued Certificates
          </span>
        </button>
      </div>

      {activeTab === 'queue' ? <ApprovalQueue /> : <IssuedCertificates />}
    </div>
    </DashboardLayout>
  );
}

function ApprovalQueue() {
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [approveDialog, setApproveDialog] = useState<EligibleStudentOut | null>(null);

  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }));
  const { data: coursesData } = useApi(
    () => listCourses({ per_page: 100, batch_id: selectedBatch || undefined }),
    [selectedBatch],
  );

  const {
    data: requestsData,
    loading: requestsLoading,
    refetch: refetchRequests,
  } = useApi(
    () => listCertificateRequests({
      batch_id: selectedBatch || undefined,
      course_id: selectedCourse || undefined,
      per_page: 100,
    }),
    [selectedBatch, selectedCourse],
  );

  const { execute: doApprove, loading: approving } = useMutation(approveCertificateRequest);

  const batches: BatchOut[] = batchesData?.data || [];
  const courses: CourseOut[] = coursesData?.data || [];
  const requests: EligibleStudentOut[] = requestsData?.data || [];

  const handleApprove = async (request: EligibleStudentOut) => {
    if (!request.certUuid) return;
    try {
      await doApprove(request.certUuid);
      toast.success(`Certificate approved for ${request.certificateName || request.studentName}`);
      setApproveDialog(null);
      refetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve certificate');
      setApproveDialog(null);
    }
  };

  const selectClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50';

  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Filter by Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => { setSelectedBatch(e.target.value); setSelectedCourse(''); }}
              className={selectClass}
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Filter by Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className={selectClass}
              disabled={!selectedBatch}
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {requestsLoading && <PageLoading variant="table" />}

      {!requestsLoading && requests.length === 0 && (
        <EmptyState
          icon={<Clock size={28} className="text-gray-400" />}
          title="No Pending Requests"
          description="No students have requested certificates yet. When students reach the completion threshold and submit a request, they will appear here."
        />
      )}

      {!requestsLoading && requests.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <p className="text-sm text-gray-500">{requests.length} pending request(s)</p>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {requests.map((request) => (
              <div key={request.certUuid || request.studentId} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary truncate">{request.certificateName || request.studentName}</p>
                    {request.certificateName && request.certificateName !== request.studentName && (
                      <p className="text-xs text-gray-400">Account: {request.studentName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setApproveDialog(request)}
                    disabled={approving}
                    className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
                  >
                    {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Approve
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">{request.studentEmail}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(request.completionPercentage, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{request.completionPercentage}%</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {request.requestedAt
                      ? new Date(request.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Name on Certificate</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Student Account</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Completion</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Requested</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.certUuid || request.studentId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-primary">{request.certificateName || '—'}</p>
                      {request.certificateName && request.certificateName !== request.studentName && (
                        <p className="text-xs text-gray-400 mt-0.5">Account: {request.studentName}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{request.studentName}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{request.studentEmail}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${Math.min(request.completionPercentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{request.completionPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">
                      {request.requestedAt
                        ? new Date(request.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setApproveDialog(request)}
                        disabled={approving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
                      >
                        {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Dialog */}
      <AlertDialog open={!!approveDialog} onOpenChange={(open) => !open && setApproveDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Certificate Request</AlertDialogTitle>
            <AlertDialogDescription>
              Issue a certificate for <strong>{approveDialog?.certificateName || approveDialog?.studentName}</strong> (
              {approveDialog?.studentEmail}) with {approveDialog?.completionPercentage}% completion?
              {approveDialog?.certificateName && approveDialog.certificateName !== approveDialog.studentName && (
                <span className="block mt-2 text-amber-600">
                  Note: The certificate name &ldquo;{approveDialog.certificateName}&rdquo; differs from the account name &ldquo;{approveDialog.studentName}&rdquo;.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveDialog && handleApprove(approveDialog)}
              className="bg-primary hover:bg-primary/80 text-white"
            >
              Approve & Generate PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function IssuedCertificates() {
  const { data, loading, error, refetch } = useApi(() => listCertificates({ per_page: 100 }));
  const { execute: doDownload } = useMutation(downloadCertificate);
  const { execute: doRevoke, loading: revoking } = useMutation(revokeCertificate);

  const [revokeDialog, setRevokeDialog] = useState<CertificateOut | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const certs: CertificateOut[] = data?.data || [];

  const handleDownload = async (cert: CertificateOut) => {
    try {
      const res = await doDownload(cert.id);
      window.open(res.downloadUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download');
    }
  };

  const handleRevoke = async () => {
    if (!revokeDialog || !revokeReason.trim()) return;
    try {
      await doRevoke(revokeDialog.id, revokeReason.trim());
      toast.success('Certificate revoked');
      setRevokeDialog(null);
      setRevokeReason('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke');
    }
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  if (certs.length === 0) {
    return (
      <EmptyState
        icon={<Award size={28} className="text-gray-400" />}
        title="No Certificates Issued"
        description="Approve student requests from the Certificate Requests tab to issue certificates."
      />
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {/* Mobile card view */}
        <div className="md:hidden space-y-3 p-4">
          {certs.map((cert) => (
            <div key={cert.id} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary truncate">{cert.certificateName || cert.studentName}</p>
                  <p className="text-xs text-gray-500">{cert.studentEmail}</p>
                </div>
                <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ${statusBadge[cert.status] || 'bg-gray-100 text-gray-600'}`}>
                  {cert.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1 mb-3">
                <p>{cert.courseTitle} / {cert.batchName}</p>
                {cert.certificateId && (
                  <p className="font-mono text-gray-400">{cert.certificateId}</p>
                )}
                <p>
                  {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {cert.status === 'approved' && (
                  <>
                    <button
                      onClick={() => handleDownload(cert)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium transition-colors"
                    >
                      <Download size={14} />
                      Download
                    </button>
                    <button
                      onClick={() => setRevokeDialog(cert)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors"
                    >
                      <XCircle size={14} />
                      Revoke
                    </button>
                  </>
                )}
                {cert.status === 'revoked' && (
                  <span className="text-xs text-red-400">Revoked</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Certificate ID</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Certificate Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Student</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Course</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Batch</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Issued</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => (
                <tr key={cert.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-primary">{cert.certificateId || '—'}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-primary">{cert.certificateName || cert.studentName}</p>
                    {cert.certificateName && cert.certificateName !== cert.studentName && (
                      <p className="text-xs text-gray-400">Account: {cert.studentName}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-gray-600">{cert.studentName}</p>
                    <p className="text-xs text-gray-400">{cert.studentEmail}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{cert.courseTitle}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{cert.batchName}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadge[cert.status] || 'bg-gray-100 text-gray-600'}`}>
                      {cert.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {cert.status === 'approved' && (
                        <>
                          <button
                            onClick={() => handleDownload(cert)}
                            title="Download"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-gray-100 transition-colors"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => setRevokeDialog(cert)}
                            title="Revoke"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {cert.status === 'revoked' && (
                        <span className="text-xs text-red-400">Revoked</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke Dialog */}
      <AlertDialog open={!!revokeDialog} onOpenChange={(open) => { if (!open) { setRevokeDialog(null); setRevokeReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the certificate for <strong>{revokeDialog?.certificateName || revokeDialog?.studentName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason for revocation</label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Enter the reason for revoking this certificate..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={!revokeReason.trim() || revoking}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
            >
              {revoking ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
