'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { getBatch, listBatchStudents, enrollStudent, removeStudent, updateBatch } from '@/lib/api/batches';
import CsvImportPanel from '@/components/shared/csv-import-panel';
import { listUsers } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Trash2, Loader2, Users, Calendar, GraduationCap, BookOpen, Upload } from 'lucide-react';
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

export default function AdminBatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const { name } = useAuth();
  const basePath = useBasePath();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const { data: batch, loading: batchLoading, error: batchError, refetch: refetchBatch } = useApi(
    () => getBatch(batchId),
    [batchId],
  );

  const { data: students, loading: studentsLoading, error: studentsError, refetch: refetchStudents } = useApi(
    () => listBatchStudents(batchId),
    [batchId],
  );

  const { data: allStudentsData } = useApi(
    () => listUsers({ role: 'student', per_page: 100 }),
  );

  const { execute: doEnroll, loading: enrolling } = useMutation(
    (studentId: string) => enrollStudent(batchId, studentId),
  );

  const { execute: doRemove } = useMutation(
    (studentId: string) => removeStudent(batchId, studentId),
  );

  const enrolledIds = useMemo(() => {
    if (!students || !Array.isArray(students)) return new Set<string>();
    return new Set(students.map((s: any) => s.id));
  }, [students]);

  const availableStudents = useMemo(() => {
    const all = allStudentsData?.data || [];
    return all.filter((s) => !enrolledIds.has(s.id));
  }, [allStudentsData, enrolledIds]);

  const handleEnroll = async () => {
    if (!selectedStudentId) return;
    try {
      await doEnroll(selectedStudentId);
      toast.success('Student enrolled');
      setSelectedStudentId('');
      refetchStudents();
      refetchBatch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (studentId: string) => {
    try {
      await doRemove(studentId);
      toast.success('Student removed');
      setRemoveConfirmId(null);
      refetchStudents();
      refetchBatch();
    } catch (err: any) {
      toast.error(err.message);
      setRemoveConfirmId(null);
    }
  };

  const loading = batchLoading || studentsLoading;
  const error = batchError || studentsError;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href={`${basePath}/batches`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors">
          <ArrowLeft size={16} />
          Back to Batches
        </Link>
      </div>

      {loading && <PageLoading variant="detail" />}
      {error && <PageError message={error} onRetry={() => { refetchBatch(); refetchStudents(); }} />}

      {!loading && !error && batch && (
        <>
          {/* Batch Info Card */}
          <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">{batch.name}</h2>
              <span className={`mt-2 sm:mt-0 inline-block px-3 py-1 rounded-full text-xs font-medium ${
                batch.status === 'active' ? 'bg-green-100 text-green-700' :
                batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {batch.status}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <GraduationCap size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Teacher</p>
                  <p className="text-sm font-medium text-primary">{batch.teacherName || 'Unassigned'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Users size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Students</p>
                  <p className="text-sm font-medium text-primary">{batch.studentCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <BookOpen size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Courses</p>
                  <p className="text-sm font-medium text-primary">{batch.courseCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <Calendar size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-medium text-primary">
                    {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'} - {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Gating Settings */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow mb-6">
            <h3 className="text-sm font-semibold text-primary mb-3">Progress Gating</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Require sequential video completion</p>
                <p className="text-xs text-gray-400 mt-0.5">Students must complete each lecture before accessing the next</p>
              </div>
              <button
                onClick={async () => {
                  const newValue = !batch.enableLectureGating;
                  try {
                    await updateBatch(batchId, { enable_lecture_gating: newValue });
                    refetchBatch();
                    toast.success(newValue ? 'Progress gating enabled' : 'Progress gating disabled');
                  } catch { toast.error('Failed to update setting'); }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${batch.enableLectureGating ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${batch.enableLectureGating ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {batch.enableLectureGating && (
              <div className="mt-4 flex items-center gap-3">
                <label className="text-xs text-gray-500">Completion threshold:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={batch.lectureGatingThreshold}
                  onChange={async (e) => {
                    const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                    try {
                      await updateBatch(batchId, { lecture_gating_threshold: val });
                      refetchBatch();
                    } catch { toast.error('Failed to update threshold'); }
                  }}
                  className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center focus:outline-none focus:border-gray-400"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            )}
          </div>

          {/* Bulk Import Panel */}
          {showImport && (
            <CsvImportPanel
              onSuccess={() => { refetchStudents(); refetchBatch(); }}
              onClose={() => setShowImport(false)}
              batches={[{ id: batchId, name: batch.name }]}
              preSelectedBatchIds={[batchId]}
            />
          )}

          {/* Add Student Section */}
          <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-primary">Enroll Student</h3>
              <button
                onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload size={14} />
                Import CSV
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
              >
                <option value="">Select a student...</option>
                {availableStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
              <button
                onClick={handleEnroll}
                disabled={!selectedStudentId || enrolling}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {enrolling ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Enroll Student
              </button>
            </div>
          </div>

          {/* Enrolled Students Table */}
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-primary">Enrolled Students ({Array.isArray(students) ? students.length : 0})</h3>
            </div>

            {!Array.isArray(students) || students.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users size={28} className="text-gray-400" />}
                  title="No students enrolled"
                  description="Use the dropdown above to enroll students in this batch."
                />
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3 p-4">
                  {students.map((student: any) => (
                    <div key={student.id} className="bg-white rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">{student.name}</span>
                        <button
                          onClick={() => setRemoveConfirmId(student.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>{student.email} {student.phone ? `\u00B7 ${student.phone}` : ''}</p>
                        <p className="text-gray-500">Enrolled: {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Enrolled Date</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student: any) => (
                        <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-primary">{student.name}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.email}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.phone || '—'}</td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">
                            {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <button
                              onClick={() => setRemoveConfirmId(student.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <AlertDialog open={!!removeConfirmId} onOpenChange={(open) => !open && setRemoveConfirmId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to remove this student from the batch? They will lose access to all batch courses and materials.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => removeConfirmId && handleRemove(removeConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </DashboardLayout>
  );
}
