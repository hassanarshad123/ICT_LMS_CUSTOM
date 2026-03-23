'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useMutation } from '@/hooks/use-api';
import { listJobs, createJob, deleteJob, listApplications } from '@/lib/api/jobs';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Briefcase, MapPin, DollarSign, Clock, Trash2, ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';
import { StyledSelect } from '@/components/ui/styled-select';
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

export default function CourseCreatorJobs() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [showForm, setShowForm] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [applications, setApplications] = useState<Record<string, any[]>>({});
  const [loadingApps, setLoadingApps] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    jobType: 'full-time',
    salary: '',
    description: '',
    requirements: '',
    deadline: '',
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: jobList, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listJobs({ ...params }),
    15,
  );

  const { execute: doCreate, loading: creating } = useMutation(createJob);
  const { execute: doDelete } = useMutation(deleteJob);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await doCreate({
        title: formData.title,
        company: formData.company,
        location: formData.location,
        jobType: formData.jobType,
        salary: formData.salary,
        description: formData.description,
        requirements: formData.requirements.split(',').map((r: string) => r.trim()).filter(Boolean),
        deadline: formData.deadline,
      });
      toast.success('Job posted');
      setFormData({ title: '', company: '', location: '', jobType: 'full-time', salary: '', description: '', requirements: '', deadline: '' });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await doDelete(jobId);
      toast.success('Job deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  const toggleExpand = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    if (!applications[jobId]) {
      setLoadingApps(jobId);
      try {
        const apps = await listApplications(jobId);
        setApplications((prev) => ({ ...prev, [jobId]: Array.isArray(apps) ? apps : [] }));
      } catch {
        setApplications((prev) => ({ ...prev, [jobId]: [] }));
      } finally {
        setLoadingApps(null);
      }
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50';

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Jobs" subtitle="Post job opportunities for students" />

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Post New Job'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Job Posting</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Data Entry Operator" className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
              <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} placeholder="e.g. TechVentures Lahore" className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
              <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g. Lahore" className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Type</label>
              <StyledSelect
                options={[
                  { value: 'full-time', label: 'Full-time' },
                  { value: 'part-time', label: 'Part-time' },
                  { value: 'internship', label: 'Internship' },
                  { value: 'remote', label: 'Remote' },
                ]}
                value={formData.jobType}
                onChange={(value) => setFormData({ ...formData, jobType: value })}
                placeholder="Select job type"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Salary</label>
              <input type="text" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} placeholder="e.g. PKR 35,000 - 45,000" className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
              <input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} className={inputClass} required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the job role and responsibilities" rows={3} className={`${inputClass} resize-none`} required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Requirements (comma separated)</label>
              <input type="text" value={formData.requirements} onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} placeholder="e.g. Basic computer skills, MS Office proficiency" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60">
                {creating && <Loader2 size={16} className="animate-spin" />}
                Post Job
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="table" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && jobList.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={28} className="text-gray-400" />}
          title="No jobs posted yet"
          description="Post your first job opportunity for students."
          action={{ label: 'Post New Job', onClick: () => setShowForm(true) }}
        />
      ) : !loading && !error && (
        <>
          <div className="space-y-4">
            {jobList.map((job) => {
              const isExpanded = expandedJob === job.id;
              const jobApps = applications[job.id] || [];
              const isLoadingApps = loadingApps === job.id;

              return (
                <div key={job.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                  <div className="flex items-start justify-between p-5">
                    <button
                      onClick={() => toggleExpand(job.id)}
                      className="flex items-start gap-4 flex-1 text-left"
                    >
                      <div className="w-11 h-11 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Briefcase size={18} className="text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-primary">{job.title}</h4>
                        <p className="text-sm text-gray-500 mt-0.5">{job.company}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            job.type === 'full-time' ? 'bg-blue-100 text-blue-700' :
                            job.type === 'part-time' ? 'bg-purple-100 text-purple-700' :
                            job.type === 'internship' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {job.type}
                          </span>
                          {job.location && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MapPin size={12} />
                              {job.location}
                            </span>
                          )}
                          {job.salary && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <DollarSign size={12} />
                              {job.salary}
                            </span>
                          )}
                          {job.deadline && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock size={12} />
                              Deadline: {job.deadline}
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-1" /> : <ChevronDown size={16} className="text-gray-400 mt-1" />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(job.id)}
                      className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Delete job"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 sm:px-5 py-4 ml-0 sm:ml-16">
                      {job.description && (
                        <p className="text-sm text-gray-700 mb-4">{job.description}</p>
                      )}
                      {(job.requirements || []).length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Requirements</h5>
                          <ul className="space-y-1.5">
                            {job.requirements!.map((req, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Applications */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                          <Users size={14} className="text-gray-500" />
                          <h5 className="text-xs font-semibold text-gray-500 uppercase">Applications</h5>
                        </div>
                        {isLoadingApps ? (
                          <div className="flex items-center gap-2 py-2">
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                            <span className="text-xs text-gray-500">Loading applications...</span>
                          </div>
                        ) : jobApps.length === 0 ? (
                          <p className="text-xs text-gray-400">No applications yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {jobApps.map((app: any) => (
                              <div key={app.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                                <div>
                                  <p className="text-sm font-medium text-primary">{app.studentName || app.name || 'Student'}</p>
                                  <p className="text-xs text-gray-400">{app.email || ''}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  app.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                  app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {app.status || 'pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-4">Posted {job.postedDate ? new Date(job.postedDate).toLocaleDateString() : '—'}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6">
              <p className="text-sm text-gray-500 mb-2 sm:mb-0">
                Page {page} of {totalPages} ({total} jobs)
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>
            </div>
          )}
        </>
      )}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this job posting? This will also delete all associated applications.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
