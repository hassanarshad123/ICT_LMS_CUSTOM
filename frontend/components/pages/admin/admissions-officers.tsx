'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { usePaginatedApi } from '@/hooks/use-paginated-api';
import { useApi, useMutation } from '@/hooks/use-api';
import { listUsers, createUser, changeUserStatus, deleteUser } from '@/lib/api/users';
import { listFrappeSalesPersons, type SalesPersonItem } from '@/lib/api/integrations';
import { PageLoading, PageError, EmptyState } from '@/components/shared/page-states';
import { toast } from 'sonner';
import { Plus, X, Trash2, UserPlus, Loader2, Eye, EyeOff, ChevronsUpDown, AlertCircle, Check } from 'lucide-react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AdminAdmissionsOfficers() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', employeeId: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<SalesPersonItem | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  const { data: officers, total, page, totalPages, loading, error, setPage, refetch } = usePaginatedApi(
    (params) => listUsers({ ...params, role: 'admissions-officer', search: search || undefined }),
    15,
    [search],
  );

  const {
    data: frappeData,
    loading: agentsLoading,
    refetch: refetchAgents,
  } = useApi(() => listFrappeSalesPersons(), []);

  const { execute: doCreate, loading: creating } = useMutation(createUser);
  const { execute: doToggleStatus } = useMutation(changeUserStatus);
  const { execute: doDelete } = useMutation(deleteUser);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await doCreate({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'admissions-officer',
        password: formData.password,
        employeeId: formData.employeeId || undefined,
      });
      toast.success('Admissions officer created successfully');
      setFormData({ name: '', email: '', phone: '', password: '', employeeId: '' });
      setSelectedAgent(null);
      setManualMode(false);
      setShowPassword(false);
      setShowForm(false);
      refetch();
      refetchAgents();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await doToggleStatus(userId, newStatus);
      toast.success(`Officer ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await doDelete(deleteConfirmId);
      toast.success('Admissions officer deleted');
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
      setDeleteConfirmId(null);
    }
  };

  const showPicker = frappeData?.enabled && !manualMode;
  const showManualFields = manualMode || !frappeData?.enabled;

  return (
    <DashboardLayout>
      <DashboardHeader
        greeting="Admissions Officers"
        subtitle="Manage your admissions team — officers onboard paying students and collect fees"
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search admissions officers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-white"
        />
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Admissions Officer'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
          <h3 className="text-lg font-semibold text-primary mb-4">New Admissions Officer</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {showPicker && (
              <div className="sm:col-span-2 lg:col-span-3 mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Select Sales Agent from ERP
                </label>
                <Popover open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="truncate">
                        {selectedAgent
                          ? `${selectedAgent.fullName} · ${selectedAgent.employeeId}`
                          : agentsLoading
                          ? 'Loading sales agents…'
                          : 'Pick a sales agent…'}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 flex-none ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name or employee ID…" />
                      <CommandList>
                        <CommandEmpty>No agents found.</CommandEmpty>
                        <CommandGroup>
                          {(frappeData?.salesPersons ?? []).map((sp) => (
                            <CommandItem
                              key={sp.employeeId}
                              value={`${sp.fullName} ${sp.employeeId}`}
                              disabled={sp.alreadyMapped}
                              onSelect={() => {
                                setSelectedAgent(sp);
                                setFormData((prev) => ({
                                  name: sp.fullName,
                                  email: sp.email ?? '',
                                  phone: sp.phone ?? '',
                                  password: prev.password,
                                  employeeId: sp.employeeId,
                                }));
                                setAgentPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedAgent?.employeeId === sp.employeeId
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{sp.fullName}</div>
                                <div className="text-xs text-gray-500 truncate">
                                  {sp.employeeId} · {sp.email ?? 'no email'}
                                  {sp.commissionRate ? ` · ${sp.commissionRate}` : ''}
                                </div>
                              </div>
                              {sp.alreadyMapped && (
                                <Badge variant="secondary" className="ml-2">
                                  Already linked
                                </Badge>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  onClick={() => {
                    setManualMode(true);
                    setSelectedAgent(null);
                  }}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Can't find them? Enter manually
                </button>
              </div>
            )}

            {frappeData && !frappeData.enabled && (
              <div className="sm:col-span-2 lg:col-span-3 mb-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-none" />
                <div>
                  Frappe ERP not connected. Enter the officer's details manually below.
                  <a href="integrations" className="ml-1 text-amber-800 underline">
                    Configure Frappe →
                  </a>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="officer@institute.edu.pk"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0300-1234567"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {showManualFields && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Employee ID (optional)
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  placeholder="e.g. MITT5037"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary bg-gray-50"
                />
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
              >
                {creating && <Loader2 size={16} className="animate-spin" />}
                Add Admissions Officer
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <PageLoading variant="cards" />}
      {error && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && officers.length === 0 ? (
        <EmptyState
          icon={<UserPlus size={28} className="text-gray-400" />}
          title="No admissions officers yet"
          description="Add your first admissions officer to start onboarding paying students."
          action={{ label: 'Add Admissions Officer', onClick: () => setShowForm(true) }}
        />
      ) : !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {officers.map((officer: any) => (
            <div
              key={officer.id}
              className="bg-white rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-semibold text-emerald-700">
                    {officer.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary">{officer.name}</h4>
                    <p className="text-xs text-gray-500">Admissions Officer</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirmId(officer.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete admissions officer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p>{officer.email}</p>
                <p>{officer.phone || '—'}</p>
                {officer.employeeId && (
                  <p className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-mono">
                    {officer.employeeId}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    officer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {officer.status ? officer.status.charAt(0).toUpperCase() + officer.status.slice(1) : ''}
                </span>
                <button
                  onClick={() => toggleStatus(officer.id, officer.status)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    officer.status === 'active'
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {officer.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            <span className="hidden sm:inline">
              Page {page} of {totalPages} · {total} total
            </span>
            <span className="sm:hidden">
              {page}/{totalPages}
            </span>
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admissions Officer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this admissions officer? Their onboarded students will remain — only
              the officer account is removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
