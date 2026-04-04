'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { getBatch, listBatchStudents, enrollStudent, updateBatch, toggleEnrollmentActive } from '@/lib/api/batches';
import CsvImportPanel from '@/components/shared/csv-import-panel';
import { ExtendAccessModal } from '@/components/shared/extend-access-modal';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { listUsers } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Loader2, Users, Calendar, GraduationCap, BookOpen, Upload, Pencil, X, CalendarPlus, Search } from 'lucide-react';
export default function AdminBatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const { name } = useAuth();
  const basePath = useBasePath();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [extendingStudent, setExtendingStudent] = useState<{ id: string; name: string; effectiveEndDate?: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', start_date: '', end_date: '', teacher_id: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedStudentSearch(studentSearch), 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  const { data: batch, loading: batchLoading, error: batchError, refetch: refetchBatch } = useApi(
    () => getBatch(batchId),
    [batchId],
  );

  const {
    data: students,
    total: studentsTotal,
    page: studentsPage,
    totalPages: studentsTotalPages,
    loading: studentsLoading,
    error: studentsError,
    setPage: setStudentsPage,
    refetch: refetchStudents,
  } = usePaginatedApi(
    (params) => listBatchStudents(batchId, { ...params, search: debouncedStudentSearch || undefined }),
    20,
    [batchId, debouncedStudentSearch],
  );

  const { data: allStudentsData } = useApi(
    () => listUsers({ role: 'student', per_page: 100 }),
  );

  const { data: teachersData } = useApi(
    () => listUsers({ role: 'teacher', per_page: 100 }),
  );
  const teachers = teachersData?.data || [];

  const { execute: doEnroll, loading: enrolling } = useMutation(
    (studentId: string) => enrollStudent(batchId, studentId),
  );

  const handleToggleActive = async (studentId: string, isActive: boolean) => {
    try {
      await toggleEnrollmentActive(batchId, studentId, isActive);
      toast.success(isActive ? 'Enrollment activated' : 'Enrollment deactivated');
      refetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

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


  const loading = batchLoading || studentsLoading;
  const error = batchError || studentsError;

  const getAccessStatus = (student: any) => {
    const effectiveEnd = student.extendedEndDate || batch?.endDate;
    if (!effectiveEnd) return { label: '—', color: 'text-gray-400' };
    const end = new Date(effectiveEnd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (daysLeft < 0) return { label: 'Expired', color: 'text-red-600' };
    if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: 'text-yellow-600' };
    return { label: end.toLocaleDateString(), color: student.extendedEndDate ? 'text-blue-600' : 'text-gray-600' };
  };

  return (
    <DashboardLayout>
      {/* Extension Modal */}
      {extendingStudent && batch && (
        <ExtendAccessModal
          batchId={batchId}
          batchEndDate={batch.endDate}
          studentId={extendingStudent.id}
          studentName={extendingStudent.name}
          currentEffectiveEndDate={extendingStudent.effectiveEndDate}
          onClose={() => setExtendingStudent(null)}
          onSuccess={() => { refetchStudents(); refetchBatch(); }}
        />
      )}

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
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-primary">{batch.name}</h2>
                <button
                  onClick={() => {
                    setEditForm({
                      name: batch.name,
                      start_date: batch.startDate?.split('T')[0] || '',
                      end_date: batch.endDate?.split('T')[0] || '',
                      teacher_id: batch.teacherId || '',
                    });
                    setShowEditModal(true);
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit Batch"
                >
                  <Pencil size={14} className="text-gray-400" />
                </button>
              </div>
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

          {/* Edit Batch Modal */}
          {showEditModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-primary">Edit Batch</h3>
                  <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-400" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Batch Name</label>
                    <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                      <input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">End Date</label>
                      <input type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Teacher</label>
                    <SearchableCombobox
                      options={teachers.map((t: any) => ({ value: t.id, label: t.name }))}
                      value={editForm.teacher_id}
                      onChange={(v) => setEditForm(f => ({ ...f, teacher_id: v }))}
                      placeholder="Unassigned"
                      searchPlaceholder="Search teachers..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={async () => {
                        if (!editForm.name.trim()) { toast.error('Batch name is required'); return; }
                        setEditSaving(true);
                        try {
                          await updateBatch(batchId, {
                            name: editForm.name,
                            start_date: editForm.start_date,
                            end_date: editForm.end_date,
                            teacher_id: editForm.teacher_id || null,
                          });
                          refetchBatch();
                          setShowEditModal(false);
                          toast.success('Batch updated');
                        } catch (err: any) { toast.error(err.message || 'Failed to update'); }
                        finally { setEditSaving(false); }
                      }}
                      disabled={editSaving}
                      className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {editSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                      Save Changes
                    </button>
                    <button onClick={() => setShowEditModal(false)} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <SearchableCombobox
                options={availableStudents.map((s) => ({ value: s.id, label: `${s.name} (${s.email})` }))}
                value={selectedStudentId}
                onChange={setSelectedStudentId}
                placeholder="Select a student..."
                searchPlaceholder="Search students..."
                emptyMessage="No students found"
                className="flex-1"
              />
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-semibold text-primary">Enrolled Students ({studentsTotal})</h3>
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {students.length === 0 ? (
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
                  {students.map((student: any) => {
                    const isActive = student.isActive ?? true;
                    return (
                      <div key={student.id} className="bg-white rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-primary">{student.name}</span>
                            {!isActive && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">Inactive</span>}
                          </div>
                          <button
                            onClick={() => handleToggleActive(student.studentId, !isActive)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                            title={isActive ? 'Deactivate enrollment' : 'Activate enrollment'}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                          </button>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>{student.email} {student.phone ? `\u00B7 ${student.phone}` : ''}</p>
                          <p className="text-gray-500">Enrolled: {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}</p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            Access: {(() => { const s = getAccessStatus(student); return <span className={s.color}>{s.label}</span>; })()}
                          </span>
                          <button
                            onClick={() => setExtendingStudent({ id: student.studentId, name: student.name, effectiveEndDate: student.extendedEndDate || batch?.endDate })}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary border border-primary/20 rounded-md hover:bg-primary/5"
                          >
                            <CalendarPlus size={10} />
                            Extend
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Access Until</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student: any) => {
                        const isActive = student.isActive ?? true;
                        return (
                          <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-primary">{student.name}</td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.email}</td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">
                              {(() => {
                                const status = getAccessStatus(student);
                                return <span className={`font-medium ${status.color}`}>{status.label}</span>;
                              })()}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <button
                                onClick={() => handleToggleActive(student.studentId, !isActive)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                                title={isActive ? 'Deactivate enrollment' : 'Activate enrollment'}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                              </button>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4">
                              <button
                                onClick={() => setExtendingStudent({ id: student.studentId, name: student.name, effectiveEndDate: student.extendedEndDate || batch?.endDate })}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
                                title="Extend access"
                              >
                                <CalendarPlus size={12} />
                                Extend
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {students.length > 0 && studentsTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2 sm:mb-0">
                  <span className="hidden sm:inline">Page {studentsPage} of {studentsTotalPages} ({studentsTotal} students)</span>
                  <span className="sm:hidden">{studentsPage}/{studentsTotalPages}</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setStudentsPage(studentsPage - 1)} disabled={studentsPage === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                  <button onClick={() => setStudentsPage(studentsPage + 1)} disabled={studentsPage === studentsTotalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
