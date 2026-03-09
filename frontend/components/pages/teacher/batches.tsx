'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { listBatches, listBatchStudents } from '@/lib/api/batches';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { Users, ChevronDown, ChevronUp, Layers, Loader2 } from 'lucide-react';

export default function TeacherBatches() {
  const { name, id } = useAuth();
  const basePath = useBasePath();
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchStudents, setBatchStudents] = useState<Record<string, any[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<string | null>(null);

  const { data: batchesData, loading, error, refetch } = useApi(
    () => listBatches({ teacher_id: id, per_page: 100 }),
    [id],
  );

  const teacherBatches = batchesData?.data || [];

  const toggleExpand = async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }
    setExpandedBatch(batchId);
    if (!batchStudents[batchId]) {
      setLoadingStudents(batchId);
      try {
        const students = await listBatchStudents(batchId);
        setBatchStudents((prev) => ({ ...prev, [batchId]: Array.isArray(students) ? students : [] }));
      } catch {
        setBatchStudents((prev) => ({ ...prev, [batchId]: [] }));
      } finally {
        setLoadingStudents(null);
      }
    }
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="My Batches" subtitle="View your assigned batches and their students" />

      {loading && <PageLoading variant="table" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && teacherBatches.length === 0 && (
        <EmptyState
          icon={<Layers size={28} className="text-gray-400" />}
          title="No batches assigned"
          description="You have not been assigned to any batches yet."
        />
      )}

      {!loading && !error && teacherBatches.length > 0 && (
        <div className="space-y-4">
          {teacherBatches.map((batch) => {
            const isExpanded = expandedBatch === batch.id;
            const students = batchStudents[batch.id] || [];
            const isLoadingStudents = loadingStudents === batch.id;

            return (
              <div key={batch.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                <button
                  onClick={() => toggleExpand(batch.id)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center">
                      <Users size={22} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary">{batch.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : '—'} to {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{batch.studentCount}</p>
                      <p className="text-xs text-gray-500">students</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      batch.status === 'active' ? 'bg-green-100 text-green-700' :
                      batch.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {batch.status}
                    </span>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-6">
                    <div className="ml-0 sm:ml-16">
                      {isLoadingStudents ? (
                        <div className="flex items-center gap-2 py-4 justify-center">
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                          <span className="text-sm text-gray-500">Loading students...</span>
                        </div>
                      ) : students.length > 0 ? (
                        <div className="space-y-2">
                          {students.map((student: any) => (
                            <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">
                                  {student.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-primary">{student.name}</p>
                                  <p className="text-xs text-gray-500">{student.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {student.phone && <span className="text-xs text-gray-500">{student.phone}</span>}
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {student.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 py-2">No students enrolled yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
