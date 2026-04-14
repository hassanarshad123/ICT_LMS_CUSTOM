'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import RoleGuard from '@/components/shared/role-guard';
import DashboardLayout from '@/components/layout/dashboard-layout';
import { PageLoading } from '@/components/shared/page-states';
import { PageError, EmptyState } from '@/components/shared/page-states';
import { useApi, useMutation } from '@/hooks/use-api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Key, Webhook, Plus, Copy, Trash2, ChevronDown, ChevronUp,
  Check, Send, Eye, BookOpen, Plug, Shield, ArrowRight,
  Clock, AlertTriangle, Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  createApiKey, listApiKeys, revokeApiKey,
  type ApiKeyOut, type ApiKeyCreatedOut,
} from '@/lib/api/api-keys';
import {
  createWebhook, listWebhooks, updateWebhook, deleteWebhook, testWebhook,
  listDeliveries,
  type WebhookOut, type WebhookDeliveryOut,
} from '@/lib/api/webhooks';
import FrappeTab from '@/components/integrations/frappe-tab';
import SyncHealthTab from '@/components/integrations/sync-health-tab';
import BulkImportTab from '@/components/integrations/bulk-import-tab';
import { Activity, Upload } from 'lucide-react';

const WEBHOOK_EVENTS = [
  { group: 'Student Lifecycle', events: ['user.created', 'user.updated', 'user.deactivated', 'user.deleted'] },
  { group: 'Enrollment', events: ['enrollment.created', 'enrollment.removed'] },
  { group: 'Certificates & Progress', events: ['certificate.requested', 'certificate.approved', 'certificate.issued', 'certificate.revoked', 'lecture.progress_updated'] },
  { group: 'Classes & Attendance', events: ['class.scheduled', 'class.started', 'class.ended', 'attendance.recorded', 'recording.ready'] },
  { group: 'Fee Lifecycle', events: ['fee.plan_created', 'fee.payment_recorded', 'fee.installment_overdue', 'fee.plan_cancelled', 'fee.plan_completed'] },
];

// ── Stat Card ───────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-primary leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── API Keys Tab ─────────────────────────────────────────────

function ApiKeysTab() {
  const { data: keys, loading, error, refetch } = useApi(listApiKeys, []);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMut = useMutation(
    useCallback((n: string, exp?: string) =>
      createApiKey({ name: n, expiresAt: exp || undefined }), [])
  );
  const revokeMut = useMutation(
    useCallback((id: string) => revokeApiKey(id), [])
  );

  const handleCreate = async () => {
    try {
      const result = await createMut.execute(name, expiresAt) as ApiKeyCreatedOut;
      setCreatedKey(result.apiKey);
      setName('');
      setExpiresAt('');
      refetch();
      toast.success('API key created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeMut.execute(id);
      refetch();
      toast.success('API key revoked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  const activeKeys = keys?.filter((k: ApiKeyOut) => k.isActive) || [];
  const revokedKeys = keys?.filter((k: ApiKeyOut) => !k.isActive) || [];

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">
            API keys authenticate external systems with your LMS REST API.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Maximum 5 active keys per institute</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreatedKey(null); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow"
        >
          <Plus size={16} />
          Create API Key
        </button>
      </div>

      {/* Key cards */}
      {keys && keys.length > 0 ? (
        <div className="space-y-5">
          {/* Active keys */}
          {activeKeys.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Keys</h3>
              <div className="grid gap-3">
                {activeKeys.map((k: ApiKeyOut) => (
                  <div key={k.id} className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 hover:border-gray-200 transition-all group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 border border-green-100">
                          <Key size={18} className="text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 mb-1">
                            <h3 className="font-semibold text-gray-900 text-sm">{k.name}</h3>
                            <Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-50 text-[10px] px-1.5 py-0">Active</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <code className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md font-mono text-gray-600">{k.keyPrefix}...</code>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              Created {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}
                            </span>
                            <span>
                              Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                            </span>
                            {k.expiresAt && (
                              <span className="flex items-center gap-1 text-amber-500">
                                <AlertTriangle size={11} />
                                Expires {new Date(k.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately disable the key &quot;{k.name}&quot;. Any integrations using this key will stop working.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevoke(k.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revoked keys */}
          {revokedKeys.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Revoked Keys</h3>
              <div className="grid gap-2">
                {revokedKeys.map((k: ApiKeyOut) => (
                  <div key={k.id} className="bg-gray-50/50 rounded-xl border border-gray-100 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Key size={14} className="text-gray-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 line-through">{k.name}</span>
                          <Badge variant="secondary" className="bg-gray-100 text-gray-400 text-[10px] px-1.5 py-0">Revoked</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                          <code className="font-mono">{k.keyPrefix}...</code>
                          <span>Revoked {k.revokedAt ? new Date(k.revokedAt).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={<Key size={28} className="text-gray-400" />}
          title="No API Keys"
          description="Create an API key to allow external systems to access your LMS data."
          action={{ label: 'Create API Key', onClick: () => { setShowCreate(true); setCreatedKey(null); } }}
        />
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            {!createdKey && (
              <DialogDescription>Give your API key a name to identify its purpose.</DialogDescription>
            )}
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>Copy this key now. You won&apos;t be able to see it again.</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-xl text-xs break-all font-mono text-gray-800">
                  {createdKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Zapier Integration"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expires At <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={!name.trim() || createMut.loading}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {createMut.loading ? 'Creating...' : 'Create'}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Webhooks Tab ─────────────────────────────────────────────

function WebhooksTab() {
  const { data: webhooks, loading, error, refetch } = useApi(listWebhooks, []);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryOut[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const createMut = useMutation(
    useCallback(() => createWebhook({ url, events: selectedEvents, description: description || undefined }), [url, selectedEvents, description])
  );
  const updateMut = useMutation(
    useCallback((id: string, data: any) => updateWebhook(id, data), [])
  );
  const deleteMut = useMutation(
    useCallback((id: string) => deleteWebhook(id), [])
  );
  const testMut = useMutation(
    useCallback((id: string) => testWebhook(id), [])
  );

  const resetForm = () => {
    setUrl('');
    setDescription('');
    setSelectedEvents([]);
    setEditId(null);
  };

  const handleCreate = async () => {
    try {
      await createMut.execute();
      setShowCreate(false);
      resetForm();
      refetch();
      toast.success('Webhook created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create webhook');
    }
  };

  const handleEdit = (wh: WebhookOut) => {
    setEditId(wh.id);
    setUrl(wh.url);
    setDescription(wh.description || '');
    setSelectedEvents(wh.events);
    setShowCreate(true);
  };

  const handleUpdate = async () => {
    if (!editId) return;
    try {
      await updateMut.execute(editId, { url, events: selectedEvents, description: description || undefined });
      setShowCreate(false);
      resetForm();
      refetch();
      toast.success('Webhook updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update webhook');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.execute(id);
      refetch();
      toast.success('Webhook deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete webhook');
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testMut.execute(id);
      if (result.success) {
        toast.success(`Test successful (HTTP ${result.statusCode})`);
      } else {
        toast.error(`Test failed${result.statusCode ? ` (HTTP ${result.statusCode})` : ''}: ${result.responseBody?.slice(0, 100) || 'No response'}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to test webhook');
    }
  };

  const handleToggleActive = async (wh: WebhookOut) => {
    try {
      await updateMut.execute(wh.id, { isActive: !wh.isActive });
      refetch();
      toast.success(wh.isActive ? 'Webhook paused' : 'Webhook activated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update webhook');
    }
  };

  const handleToggleDeliveries = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLoadingDeliveries(true);
    try {
      const result = await listDeliveries(id, 1);
      setDeliveries(result.data);
    } catch {
      setDeliveries([]);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">
            Webhooks send real-time HTTP notifications to your systems when events occur.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">HMAC-SHA256 signed with automatic retries</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow"
        >
          <Plus size={16} />
          Create Webhook
        </button>
      </div>

      {webhooks && webhooks.length > 0 ? (
        <div className="space-y-3">
          {webhooks.map((wh: WebhookOut) => (
            <div key={wh.id} className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden hover:border-gray-200 transition-all">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${wh.isActive ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                      <Webhook size={18} className={wh.isActive ? 'text-blue-600' : 'text-gray-400'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <code className="text-sm font-semibold text-gray-900 truncate block">{wh.url}</code>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${wh.isActive ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
                          {wh.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      {wh.description && (
                        <p className="text-xs text-gray-500 mb-2">{wh.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {wh.events.slice(0, 4).map(event => (
                          <span key={event} className="text-[10px] font-mono bg-gray-50 border border-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {event}
                          </span>
                        ))}
                        {wh.events.length > 4 && (
                          <span className="text-[10px] bg-gray-50 border border-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                            +{wh.events.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <Switch
                              checked={wh.isActive}
                              onCheckedChange={() => handleToggleActive(wh)}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent><p>{wh.isActive ? 'Pause' : 'Activate'}</p></TooltipContent>
                      </Tooltip>

                      <div className="w-px h-6 bg-gray-100 mx-1" />

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleTest(wh.id)}
                            disabled={testMut.loading}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          >
                            <Send size={15} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p>Send test event</p></TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleEdit(wh)}
                            className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-all"
                          >
                            <Pencil size={15} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p>Edit</p></TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleToggleDeliveries(wh.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-all"
                          >
                            {expandedId === wh.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p>Delivery log</p></TooltipContent>
                      </Tooltip>

                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <button className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                <Trash2 size={15} />
                              </button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete</p></TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this webhook endpoint. Events will no longer be delivered to this URL.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(wh.id)} className="bg-red-600 hover:bg-red-700">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TooltipProvider>
                </div>
              </div>

              {/* Delivery Log */}
              {expandedId === wh.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Deliveries</h4>
                  {loadingDeliveries ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-gray-400">Loading deliveries...</span>
                    </div>
                  ) : deliveries.length > 0 ? (
                    <div className="space-y-1.5">
                      {deliveries.map((d: WebhookDeliveryOut) => (
                        <div key={d.id} className="flex items-center gap-3 text-xs bg-white rounded-xl border border-gray-100 px-4 py-2.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.status === 'success' ? 'bg-green-500' : d.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <span className="font-mono font-medium text-gray-700">{d.eventType}</span>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${
                            d.status === 'success' ? 'bg-green-50 text-green-600' :
                            d.status === 'failed' ? 'bg-red-50 text-red-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {d.statusCode ? `HTTP ${d.statusCode}` : d.status}
                          </Badge>
                          <span className="text-gray-400 ml-auto flex-shrink-0">
                            {d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-1">No deliveries recorded yet</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Webhook size={28} className="text-gray-400" />}
          title="No Webhooks"
          description="Create a webhook to receive real-time event notifications."
          action={{ label: 'Create Webhook', onClick: () => { resetForm(); setShowCreate(true); } }}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              {editId ? 'Update the webhook endpoint configuration.' : 'Configure a new webhook endpoint to receive event notifications.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Endpoint URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-system.com/webhooks"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-[11px] text-gray-400 mt-1">Must be HTTPS. We&apos;ll send POST requests to this URL.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., CRM sync endpoint"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Subscribe to Events</label>
              <div className="space-y-4">
                {WEBHOOK_EVENTS.map(group => (
                  <div key={group.group}>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.events.map(event => (
                        <button
                          key={event}
                          onClick={() => toggleEvent(event)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                            selectedEvents.includes(event)
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-gray-50 border border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {event}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {selectedEvents.length > 0 && (
                <p className="text-[11px] text-primary mt-3 font-medium">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => { setShowCreate(false); resetForm(); }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editId ? handleUpdate : handleCreate}
              disabled={!url.startsWith('https://') || selectedEvents.length === 0 || createMut.loading || updateMut.loading}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {(createMut.loading || updateMut.loading) ? 'Saving...' : editId ? 'Update Webhook' : 'Create Webhook'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

function IntegrationsContent() {
  const { id } = useAuth();
  const { data: keys } = useApi(listApiKeys, []);
  const { data: webhooks } = useApi(listWebhooks, []);

  const activeKeys = keys?.filter((k: ApiKeyOut) => k.isActive).length || 0;
  const activeWebhooks = webhooks?.filter((w: WebhookOut) => w.isActive).length || 0;
  const totalEvents = webhooks?.reduce((sum: number, w: WebhookOut) => sum + (w.isActive ? w.events.length : 0), 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plug size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary tracking-tight">Integrations</h1>
                <p className="text-sm text-gray-500">
                  Connect external systems via REST API and real-time webhooks.
                </p>
              </div>
            </div>
          </div>
          <Link
            href={`/${id}/integrations/api-docs`}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary bg-primary/5 border border-primary/15 rounded-xl hover:bg-primary/10 transition-all group"
          >
            <BookOpen size={16} />
            API Documentation
            <ArrowRight size={14} className="text-primary/50 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={<Key size={20} className="text-primary" />}
            label="Active API Keys"
            value={activeKeys}
            sub={`of 5 maximum`}
          />
          <StatCard
            icon={<Webhook size={20} className="text-primary" />}
            label="Active Webhooks"
            value={activeWebhooks}
          />
          <StatCard
            icon={<Shield size={20} className="text-primary" />}
            label="Event Subscriptions"
            value={totalEvents}
            sub="across all webhooks"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="api-keys" className="space-y-5">
          <TabsList className="bg-gray-100/80 p-1 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="api-keys" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4">
              <Key size={15} />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4">
              <Webhook size={15} />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="frappe" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4">
              <Plug size={15} />
              Frappe / ERPNext
            </TabsTrigger>
            <TabsTrigger value="sync-health" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4">
              <Activity size={15} />
              Sync Health
            </TabsTrigger>
            <TabsTrigger value="bulk-import" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 px-4">
              <Upload size={15} />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys">
            <ApiKeysTab />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhooksTab />
          </TabsContent>

          <TabsContent value="frappe">
            <FrappeTab />
          </TabsContent>

          <TabsContent value="sync-health">
            <SyncHealthTab />
          </TabsContent>

          <TabsContent value="bulk-import">
            <BulkImportTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default function IntegrationsPage() {
  return (
    <RoleGuard allowed={['admin']}>
      <IntegrationsContent />
    </RoleGuard>
  );
}
