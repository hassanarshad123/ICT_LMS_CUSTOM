'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import RoleGuard from '@/components/shared/role-guard';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Key, Webhook, Plus, Copy, Trash2, TestTube, ChevronDown, ChevronUp,
  Check, X, Clock, Send, Eye, BookOpen,
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

const WEBHOOK_EVENTS = [
  { group: 'Student Lifecycle', events: ['user.created', 'user.updated', 'user.deactivated', 'user.deleted'] },
  { group: 'Enrollment', events: ['enrollment.created', 'enrollment.removed'] },
  { group: 'Certificates & Progress', events: ['certificate.requested', 'certificate.approved', 'certificate.issued', 'certificate.revoked', 'lecture.progress_updated'] },
  { group: 'Classes & Attendance', events: ['class.scheduled', 'class.started', 'class.ended', 'attendance.recorded', 'recording.ready'] },
];

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          API keys allow external systems to authenticate with your LMS. Max 5 active keys.
        </p>
        <button
          onClick={() => { setShowCreate(true); setCreatedKey(null); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          <Plus size={16} />
          Create API Key
        </button>
      </div>

      {keys && keys.length > 0 ? (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-4 font-medium text-gray-500">Key Prefix</th>
                <th className="text-left px-6 py-4 font-medium text-gray-500">Last Used</th>
                <th className="text-left px-6 py-4 font-medium text-gray-500">Created</th>
                <th className="text-left px-6 py-4 font-medium text-gray-500">Status</th>
                <th className="text-right px-6 py-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k: ApiKeyOut) => (
                <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-medium text-primary">{k.name}</td>
                  <td className="px-6 py-4">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{k.keyPrefix}...</code>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {k.isActive ? (
                      <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-500">Revoked</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {k.isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                Copy this key now. You won&apos;t be able to see it again.
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 px-3 py-2.5 rounded-xl text-xs break-all font-mono">
                  {createdKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Zapier Integration"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">Expires At (optional)</label>
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
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={!name.trim() || createMut.loading}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50"
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Webhooks send real-time notifications to your systems when events occur.
        </p>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          <Plus size={16} />
          Create Webhook
        </button>
      </div>

      {webhooks && webhooks.length > 0 ? (
        <div className="space-y-3">
          {webhooks.map((wh: WebhookOut) => (
            <div key={wh.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-sm font-medium text-primary truncate">{wh.url}</code>
                    <Badge variant={wh.isActive ? 'default' : 'secondary'}
                      className={wh.isActive ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500'}>
                      {wh.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {wh.description || `${wh.events.length} event${wh.events.length !== 1 ? 's' : ''} subscribed`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Switch
                    checked={wh.isActive}
                    onCheckedChange={() => handleToggleActive(wh)}
                  />
                  <button
                    onClick={() => handleTest(wh.id)}
                    disabled={testMut.loading}
                    className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Send test event"
                  >
                    <Send size={16} />
                  </button>
                  <button
                    onClick={() => handleEdit(wh)}
                    className="p-2 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleDeliveries(wh.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 transition-colors"
                    title="Delivery log"
                  >
                    {expandedId === wh.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this webhook endpoint. Events will no longer be delivered.
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
              </div>

              {/* Delivery Log */}
              {expandedId === wh.id && (
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Recent Deliveries</h4>
                  {loadingDeliveries ? (
                    <p className="text-sm text-gray-400">Loading...</p>
                  ) : deliveries.length > 0 ? (
                    <div className="space-y-2">
                      {deliveries.map((d: WebhookDeliveryOut) => (
                        <div key={d.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2">
                          <span className={`w-2 h-2 rounded-full ${d.status === 'success' ? 'bg-green-500' : d.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <span className="font-medium text-primary">{d.eventType}</span>
                          <span className="text-gray-400">
                            {d.statusCode ? `HTTP ${d.statusCode}` : d.status}
                          </span>
                          <span className="text-gray-400 ml-auto">
                            {d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No deliveries yet</p>
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
              <label className="block text-sm font-medium text-primary mb-1.5">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-system.com/webhooks"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., CRM sync endpoint"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-3">Events</label>
              <div className="space-y-4">
                {WEBHOOK_EVENTS.map(group => (
                  <div key={group.group}>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{group.group}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.events.map(event => (
                        <button
                          key={event}
                          onClick={() => toggleEvent(event)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            selectedEvents.includes(event)
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {event}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => { setShowCreate(false); resetForm(); }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editId ? handleUpdate : handleCreate}
              disabled={!url.startsWith('https://') || selectedEvents.length === 0 || createMut.loading || updateMut.loading}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {(createMut.loading || updateMut.loading) ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { id } = useAuth();

  return (
    <RoleGuard allowed={['admin']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary">Integrations</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage API keys and webhooks for external system integrations.
            </p>
          </div>
          <Link
            href={`/${id}/integrations/api-docs`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
          >
            <BookOpen size={16} />
            View API Documentation
          </Link>
        </div>

        <Tabs defaultValue="api-keys" className="space-y-4">
          <TabsList className="bg-gray-100/80 p-1 rounded-xl">
            <TabsTrigger value="api-keys" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Key size={16} />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Webhook size={16} />
              Webhooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys">
            <ApiKeysTab />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhooksTab />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
