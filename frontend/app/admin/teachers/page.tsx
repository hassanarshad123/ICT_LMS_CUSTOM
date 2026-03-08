'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { listUsers, createUser, changeUserStatus } from '@/lib/api/users';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, GraduationCap, Loader2 } from 'lucide-react';

export default function AdminTeachers() {
  const { name } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', specialization: '' });

  const { data: teacherList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listUsers({ ...params, role: 'teacher' }),
    15,
  );

  const { execute: doCreate, loading: creating } = useMutation(createUser);
  const { execute: doToggleStatus } = useMutation(changeUserStatus);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await doCreate({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'teacher',
        specialization: formData.specialization,
      });
      toast.success(`Teacher created. Temporary password: ${result.temporaryPassword}`, { duration: 10000 });
      setFormData({ name: '', email: '', phone: '', specialization: '' });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await doToggleStatus(userId, newStatus);
      toast.success(`Teacher ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DashboardLayout role="admin" userName={name || 'Admin'}>
      <DashboardHeader greeting="Teachers" subtitle="Manage all teachers" />

      <div className="flex justify-end mb-6">
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Teacher'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">New Teacher</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Teacher full name" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="teacher@ict.edu.pk" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0300-1234567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
              <input type="text" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} placeholder="e.g. Web Development" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50" required />
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-60">
                {creating && <Loader2 size={16} className="animate-spin" />}
                Add Teacher
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && teacherList.length === 0 ? (
        <EmptyState icon={<GraduationCap size={28} className="text-gray-400" />} title="No teachers yet" description="Add your first teacher to get started." action={{ label: 'Add Teacher', onClick: () => setShowForm(true) }} />
      ) : !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teacherList.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#C5D86D] flex items-center justify-center text-lg font-semibold text-[#1A1A1A]">{teacher.name.charAt(0)}</div>
                <div>
                  <h4 className="font-semibold text-[#1A1A1A]">{teacher.name}</h4>
                  <p className="text-xs text-gray-500">{teacher.specialization || 'No specialization'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>{teacher.email}</p>
                <p>{teacher.phone || '—'}</p>
              </div>
              {teacher.batchNames && teacher.batchNames.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Assigned Batches</p>
                  <div className="flex flex-wrap gap-2">
                    {teacher.batchNames.map((name, i) => (
                      <span key={i} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${teacher.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {teacher.status}
                </span>
                <button
                  onClick={() => handleToggleStatus(teacher.id, teacher.status)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    teacher.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {teacher.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && teacherList.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        </div>
      )}
    </DashboardLayout>
  );
}
