'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useApi, useMutation } from '@/hooks/use-api';
import { listClasses, createClass, deleteClass, listAccounts } from '@/lib/api/zoom';
import { listBatches } from '@/lib/api/batches';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Video, ExternalLink, Clock, Info, Loader2, Calendar, Trash2 } from 'lucide-react';
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

export default function TeacherSchedule() {
  const { name, id } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const { data: classesData, loading: classesLoading, error: classesError, refetch: refetchClasses } = useApi(
    () => listClasses({ teacher_id: id, per_page: 100 }),
    [id],
  );
  const { data: batchesData } = useApi(
    () => listBatches({ teacher_id: id, per_page: 100 }),
    [id],
  );
  const { data: accountsData } = useApi(listAccounts);

  const { execute: doCreate, loading: creating } = useMutation(createClass);
  const { execute: doDelete } = useMutation(deleteClass);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const teacherBatches = batchesData?.data || [];
  const accounts = accountsData || [];
  const hasAccounts = accounts.length > 0;
  const defaultAccount = accounts.find((a: any) => a.isDefault);

  const [formData, setFormData] = useState({
    title: '',
    batchId: '',
    zoomAccountId: '',
    date: '',
    time: '',
    duration: '60',
  });

  // Set default zoom account once loaded (useEffect prevents render loop)
  useEffect(() => {
    if (!formData.zoomAccountId && defaultAccount) {
      setFormData((prev) => ({ ...prev, zoomAccountId: defaultAccount.id }));
    }
  }, [defaultAccount?.id]);

  const selectedAccount = accounts.find((a: any) => a.id === formData.zoomAccountId);

  const allClasses = classesData?.data || [];
  const upcoming = allClasses.filter((c) => c.status === 'upcoming' || c.status === 'scheduled');
  const completed = allClasses.filter((c) => c.status === 'completed');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await doCreate({
        title: formData.title,
        batch_id: formData.batchId,
        zoom_account_id: formData.zoomAccountId,
        scheduled_date: formData.date,
        scheduled_time: formData.time,
        duration: parseInt(formData.duration, 10) || 60,
      });
      toast.success('Class scheduled');
      setFormData({
        title: '',
        batchId: '',
        zoomAccountId: defaultAccount?.id || '',
        date: '',
        time: '',
        duration: '60',
      });
      setShowForm(false);
      refetchClasses();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      await doDelete(classId);
      toast.success('Class deleted');
      setDeleteConfirmId(null);
      refetchClasses();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50';

  return (
    <DashboardLayout role="teacher" userName={name || 'Teacher'}>
      <DashboardHeader greeting="Schedule Classes" subtitle="Manage your Zoom classes" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Schedule New Class'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Zoom Class</h3>
          {!hasAccounts ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Info size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">No Zoom accounts have been configured. Please ask your administrator to add a Zoom account in Settings before scheduling classes.</p>
            </div>
          ) : (
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Class Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Week 13 - Revision" className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch</label>
                <select value={formData.batchId} onChange={(e) => setFormData({ ...formData, batchId: e.target.value })} className={inputClass} required>
                  <option value="">Select batch</option>
                  {teacherBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Zoom Account</label>
                <select value={formData.zoomAccountId} onChange={(e) => setFormData({ ...formData, zoomAccountId: e.target.value })} className={inputClass} required>
                  <option value="">Select account</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.accountName}{a.isDefault ? ' (Default)' : ''}</option>
                  ))}
                </select>
                {selectedAccount && (
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <Info size={12} />
                    Meeting will be auto-created via: {selectedAccount.accountName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
                <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (minutes)</label>
                <input type="number" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="e.g. 60" className={inputClass} required min={1} />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60">
                  {creating && <Loader2 size={16} className="animate-spin" />}
                  Schedule Class
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {classesLoading && <PageLoading variant="table" />}
      {classesError && <PageError message={classesError} onRetry={refetchClasses} />}

      {!classesLoading && !classesError && (
        <>
          {/* Upcoming Classes */}
          {upcoming.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Upcoming Classes</h3>
              <div className="space-y-3">
                {upcoming.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-2xl p-4 sm:p-5 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#C5D86D] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Video size={22} className="text-[#1A1A1A]" />
                      </div>
                      <div>
                        <h4 className="font-medium text-[#1A1A1A]">{cls.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{cls.batchName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-14 sm:ml-0">
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#1A1A1A]">{cls.scheduledDate}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 justify-end">
                          <Clock size={12} />
                          {cls.scheduledTime} - {cls.durationDisplay || `${cls.duration} min`}
                        </div>
                      </div>
                      {cls.zoomMeetingUrl && (
                        <a href={cls.zoomStartUrl || cls.zoomMeetingUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center hover:bg-[#333] transition-colors">
                          <ExternalLink size={16} className="text-white" />
                        </a>
                      )}
                      <button
                        onClick={() => setDeleteConfirmId(cls.id)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete class"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Classes */}
          {completed.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Completed Classes</h3>
              <div className="space-y-3">
                {completed.map((cls) => (
                  <div key={cls.id} className="bg-white rounded-2xl p-4 sm:p-5 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3 opacity-75">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Video size={18} className="text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-[#1A1A1A]">{cls.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{cls.batchName}</p>
                      </div>
                    </div>
                    <div className="text-right ml-14 sm:ml-0">
                      <p className="text-sm text-gray-600">{cls.scheduledDate}</p>
                      <p className="text-xs text-gray-400">{cls.scheduledTime} - {cls.durationDisplay || `${cls.duration} min`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcoming.length === 0 && completed.length === 0 && (
            <EmptyState
              icon={<Calendar size={28} className="text-gray-400" />}
              title="No classes scheduled"
              description="Schedule your first Zoom class to get started."
              action={{ label: 'Schedule Class', onClick: () => setShowForm(true) }}
            />
          )}
        </>
      )}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zoom Class</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this scheduled class? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDeleteClass(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
