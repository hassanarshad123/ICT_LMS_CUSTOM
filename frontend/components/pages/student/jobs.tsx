'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi, useMutation } from '@/hooks/use-api';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { listJobs, applyToJob, getMyApplications } from '@/lib/api/jobs';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { jobTypeColors } from '@/lib/constants';
import { toast } from 'sonner';
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export default function StudentJobs() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'browse' | 'applications'>('browse');
  const [coverLetter, setCoverLetter] = useState('');

  // Paginated jobs with type filter
  const {
    data: jobs,
    total,
    page,
    totalPages,
    loading,
    error,
    setPage,
    refetch,
  } = usePaginatedApi(
    (params) => listJobs({
      ...params,
      type: filter !== 'all' ? filter : undefined,
    }),
    15,
    [filter],
  );

  // Track my applications
  const { data: myApplications, loading: appsLoading, refetch: refetchApps } = useApi(
    () => getMyApplications(),
  );

  const { execute: doApply, loading: applying } = useMutation(applyToJob);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  // Build a set of job IDs the student has already applied to
  const appliedJobIds = new Set(
    Array.isArray(myApplications)
      ? myApplications.map((app: any) => app.jobId)
      : [],
  );

  const handleApply = async (jobId: string) => {
    setApplyingJobId(jobId);
    try {
      await doApply(jobId, { cover_letter: coverLetter || undefined });
      toast.success('Application submitted successfully');
      setCoverLetter('');
      refetchApps();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setApplyingJobId(null);
    }
  };

  const applicationStatusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    shortlisted: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    accepted: 'bg-green-100 text-green-700',
  };

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Job Opportunities" subtitle="Find your next career opportunity" />

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'browse' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Browse Jobs
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'applications' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          My Applications {Array.isArray(myApplications) && myApplications.length > 0 && (
            <span className="ml-1.5 bg-primary text-white text-xs rounded-full px-1.5 py-0.5">{myApplications.length}</span>
          )}
        </button>
      </div>

      {/* My Applications Tab */}
      {activeTab === 'applications' && (
        <div>
          {appsLoading && <PageLoading variant="cards" />}
          {!appsLoading && (!Array.isArray(myApplications) || myApplications.length === 0) && (
            <EmptyState
              icon={<Briefcase size={28} className="text-gray-400" />}
              title="No applications yet"
              description="Browse job opportunities and apply to get started."
            />
          )}
          {!appsLoading && Array.isArray(myApplications) && myApplications.length > 0 && (
            <div className="space-y-3">
              {myApplications.map((app: any) => (
                <div key={app.id} className="bg-white rounded-2xl p-5 card-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-primary">{app.jobTitle || app.jobId}</h4>
                      <p className="text-sm text-gray-500 mt-0.5">Applied {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ''}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${applicationStatusColors[app.status] || 'bg-gray-100 text-gray-600'}`}>
                      {app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'browse' && <>
      {/* Type filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'full-time', 'part-time', 'internship', 'remote'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === type
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {type === 'all' ? 'All Jobs' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {loading && <PageLoading />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && jobs.length === 0 && (
        <EmptyState
          icon={<Briefcase size={28} className="text-gray-400" />}
          title="No jobs found"
          description="Try a different filter to see more opportunities."
        />
      )}

      {!loading && !error && jobs.length > 0 && (
        <>
          <div className="space-y-4">
            {jobs.map((job) => {
              const isExpanded = expandedJob === job.id;
              const hasApplied = appliedJobIds.has(job.id);

              return (
                <div key={job.id} className="bg-white rounded-2xl card-shadow overflow-hidden hover:card-shadow-hover transition-all duration-200">
                  <button
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                    className="w-full flex items-start justify-between p-6 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-accent bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Briefcase size={20} className="text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-primary">{job.title}</h4>
                          {hasApplied && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle2 size={10} />
                              Applied
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{job.company}</p>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          {job.location && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <MapPin size={12} />
                              {job.location}
                            </div>
                          )}
                          {job.salary && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <DollarSign size={12} />
                              {job.salary}
                            </div>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${jobTypeColors[job.type] || 'bg-gray-100 text-gray-600'}`}>
                            {job.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {job.deadline && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-500">Deadline</p>
                          <p className="text-sm font-medium text-primary">{job.deadline}</p>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 sm:px-6 pb-6 pt-0">
                      <div className="ml-0 sm:ml-16 border-t border-gray-100 pt-4">
                        {job.description && (
                          <p className="text-sm text-gray-700 mb-4">{job.description}</p>
                        )}
                        {job.requirements && job.requirements.length > 0 && (
                          <div className="mb-4">
                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Requirements</h5>
                            <ul className="space-y-1.5">
                              {job.requirements.map((req, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          {hasApplied ? (
                            <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-100 text-green-700 rounded-xl text-sm font-medium">
                              <CheckCircle2 size={14} />
                              Already Applied
                            </span>
                          ) : (
                            <div className="w-full space-y-3">
                              <textarea
                                placeholder="Cover letter (optional) — tell us why you're a great fit..."
                                value={applyingJobId === job.id ? coverLetter : ''}
                                onFocus={() => { setApplyingJobId(null); setCoverLetter(''); }}
                                onChange={(e) => { setApplyingJobId(null); setCoverLetter(e.target.value); }}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 resize-none"
                                rows={3}
                              />
                              <button
                                onClick={() => handleApply(job.id)}
                                disabled={applying && applyingJobId === job.id}
                                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors flex items-center gap-2 disabled:opacity-60"
                              >
                                {applying && applyingJobId === job.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <ExternalLink size={14} />
                                )}
                                Apply Now
                              </button>
                            </div>
                          )}
                          {job.postedDate && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={12} />
                              Posted {job.postedDate}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Showing {jobs.length} of {total} jobs
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-700 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </>}
    </DashboardLayout>
  );
}
