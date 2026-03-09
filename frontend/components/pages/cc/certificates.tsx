'use client';

import { useState, useCallback } from 'react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  listCertificates,
  listEligibleStudents,
  approveCertificate,
  approveBatchCertificates,
  downloadCertificate,
  revokeCertificate,
  CertificateOut,
  EligibleStudentOut,
} from '@/lib/api/certificates';
import { listBatches, BatchOut } from '@/lib/api/batches';
import { listCourses, CourseOut } from '@/lib/api/courses';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { Award, CheckCircle2, Download, XCircle, Loader2, Users, FileCheck } from 'lucide-react';
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Certificates</h1>
        <p className="text-sm text-gray-500 mt-1">Approve student certificates and manage issued ones</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'queue' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users size={16} />
            Approval Queue
          </span>
        </button>
        <button
          onClick={() => setActiveTab('issued')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'issued' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
  );
}

function ApprovalQueue() {
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [approveDialogStudent, setApproveDialogStudent] = useState<EligibleStudentOut | null>(null);
  const [approveAllDialog, setApproveAllDialog] = useState(false);

  const { data: batchesData } = useApi(() => listBatches({ per_page: 100 }));
  const { data: coursesData } = useApi(() => listCourses({ per_page: 100, batch_id: selectedBatch || undefined }), [selectedBatch]);

  const shouldFetchEligible = !!selectedBatch && !!selectedCourse;
  const {
    data: eligibleData,
    loading: eligibleLoading,
    refetch: refetchEligible,
  } = useApi(
    () => shouldFetchEligible
      ? listEligibleStudents({ batch_id: selectedBatch, course_id: selectedCourse, per_page: 100 })
      : Promise.resolve({ data: [], total: 0, page: 1, perPage: 100, totalPages: 1 }),
    [selectedBatch, selectedCourse],
  );

  const { execute: doApprove, loading: approving } = useMutation(approveCertificate);
  const { execute: doBatchApprove, loading: batchApproving } = useMutation(approveBatchCertificates);

  const batches: BatchOut[] = batchesData?.data || [];
  const courses: CourseOut[] = coursesData?.data || [];
  const eligible: EligibleStudentOut[] = eligibleData?.data || [];

  const handleApprove = async (student: EligibleStudentOut) => {
    try {
      await doApprove(student.studentId, selectedBatch, selectedCourse);
      toast.success(`Certificate issued for ${student.studentName}`);
      setApproveDialogStudent(null);
      refetchEligible();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve certificate');
      setApproveDialogStudent(null);
    }
  };

  const handleApproveAll = async () => {
    try {
      const ids = eligible.map((s) => s.studentId);
      const results = await doBatchApprove(ids, selectedBatch, selectedCourse);
      toast.success(`${results.length} certificate(s) issued`);
      setApproveAllDialog(false);
      refetchEligible();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve certificates');
      setApproveAllDialog(false);
    }
  };

  const selectClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50';

  return (
    <>
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Batch</label>
            <select
              value={selectedBatch}
              onChange={(e) => { setSelectedBatch(e.target.value); setSelectedCourse(''); }}
              className={selectClass}
            >
              <option value="">Choose a batch...</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className={selectClass}
              disabled={!selectedBatch}
            >
              <option value="">Choose a course...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!shouldFetchEligible && (
        <EmptyState
          icon={<Users size={28} className="text-gray-400" />}
          title="Select Batch & Course"
          description="Choose a batch and course above to see eligible students"
        />
      )}

      {shouldFetchEligible && eligibleLoading && <PageLoading variant="table" />}

      {shouldFetchEligible && !eligibleLoading && eligible.length === 0 && (
        <EmptyState
          icon={<Award size={28} className="text-gray-400" />}
          title="No Eligible Students"
          description="No students have met the completion threshold for this batch and course yet."
        />
      )}

      {shouldFetchEligible && !eligibleLoading && eligible.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <p className="text-sm text-gray-500">{eligible.length} student(s) eligible</p>
            <button
              onClick={() => setApproveAllDialog(true)}
              disabled={batchApproving}
              className="flex items-center gap-2 px-4 py-2 bg-[#C5D86D] text-[#1A1A1A] rounded-xl text-sm font-medium hover:bg-[#b8cc5c] transition-colors disabled:opacity-60"
            >
              {batchApproving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Approve All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Completion</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((student) => (
                  <tr key={student.studentId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-[#1A1A1A]">{student.studentName}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{student.studentEmail}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#C5D86D] rounded-full"
                            style={{ width: `${Math.min(student.completionPercentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{student.completionPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setApproveDialogStudent(student)}
                        disabled={approving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] text-white rounded-lg text-xs font-medium hover:bg-[#333] transition-colors disabled:opacity-60"
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

      {/* Approve Single Dialog */}
      <AlertDialog open={!!approveDialogStudent} onOpenChange={(open) => !open && setApproveDialogStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Issue a certificate for <strong>{approveDialogStudent?.studentName}</strong> with {approveDialogStudent?.completionPercentage}% completion? This will generate a PDF certificate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => approveDialogStudent && handleApprove(approveDialogStudent)} className="bg-[#1A1A1A] hover:bg-[#333] text-white">
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve All Dialog */}
      <AlertDialog open={approveAllDialog} onOpenChange={setApproveAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve All Certificates</AlertDialogTitle>
            <AlertDialogDescription>
              Issue certificates for all {eligible.length} eligible student(s)? This will generate PDF certificates for each student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveAll} className="bg-[#1A1A1A] hover:bg-[#333] text-white">
              Approve All
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
        description="Approve students from the approval queue to issue certificates."
      />
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Certificate ID</th>
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
                  <td className="px-5 py-3.5 text-sm font-mono text-[#1A1A1A]">{cert.certificateId}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-[#1A1A1A]">{cert.studentName}</p>
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
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#1A1A1A] hover:bg-gray-100 transition-colors"
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
              Are you sure you want to revoke the certificate for <strong>{revokeDialog?.studentName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason for revocation</label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Enter the reason for revoking this certificate..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50 resize-none"
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
