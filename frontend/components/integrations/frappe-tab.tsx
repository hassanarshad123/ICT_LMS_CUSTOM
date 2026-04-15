'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useApi, useMutation } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plug, Check, X, RefreshCw, Copy, Key, AlertTriangle, BookOpen, ExternalLink, Loader2,
  Circle, Link2, ChevronDown, ChevronUp, Code, Sparkles,
} from 'lucide-react';
import {
  getFrappeConfig, updateFrappeConfig, testFrappeConnection, rotateInboundSecret,
  type FrappeConfig,
} from '@/lib/api/integrations';
import { getHmacServerScript, getCustomFieldFixture } from '@/lib/integrations/frappe-snippets';
import FrappeSetupWizard from './frappe-setup-wizard';

/**
 * Derive the public LMS webhook URL from NEXT_PUBLIC_API_URL. Frappe dials
 * this directly from their server, so it must be the public API host, not
 * the frontend origin (Next.js rewrites don't apply to server-to-server calls).
 */
function buildWebhookUrl(instituteId: string | null | undefined): string {
  if (!instituteId) return '';
  const raw = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
  // Strip trailing /api/v1 if present so we can cleanly append the full path.
  const base = raw.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  // If base is empty or relative (dev without NEXT_PUBLIC_API_URL), fall back
  // to window.location.origin so the copy-button still yields something sane.
  const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/api/v1/integrations/frappe/webhook?institute_id=${instituteId}`;
}

type LocalForm = {
  frappeBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  defaultIncomeAccount: string;
  defaultReceivableAccount: string;
  defaultBankAccount: string;
  defaultModeOfPayment: string;
  defaultCostCenter: string;
  defaultCompany: string;
};

const BLANK_FORM: LocalForm = {
  frappeBaseUrl: '',
  apiKey: '',
  apiSecret: '',
  defaultIncomeAccount: '',
  defaultReceivableAccount: '',
  defaultBankAccount: '',
  defaultModeOfPayment: '',
  defaultCostCenter: '',
  defaultCompany: '',
};

function hydrateForm(cfg: FrappeConfig): LocalForm {
  return {
    frappeBaseUrl: cfg.frappeBaseUrl || '',
    apiKey: '',
    apiSecret: '',
    defaultIncomeAccount: cfg.defaultIncomeAccount || '',
    defaultReceivableAccount: cfg.defaultReceivableAccount || '',
    defaultBankAccount: cfg.defaultBankAccount || '',
    defaultModeOfPayment: cfg.defaultModeOfPayment || '',
    defaultCostCenter: cfg.defaultCostCenter || '',
    defaultCompany: cfg.defaultCompany || '',
  };
}

export default function FrappeTab() {
  const { data: cfg, loading, error, refetch } = useApi(getFrappeConfig, []);
  const { user } = useAuth();
  const copy = useCopyToClipboard();
  const [form, setForm] = useState<LocalForm>(BLANK_FORM);
  const [enabled, setEnabled] = useState(false);
  const [showSecret, setShowSecret] = useState<{ secret: string } | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const instituteId = user?.instituteId;
  const webhookUrl = useMemo(() => buildWebhookUrl(instituteId), [instituteId]);

  useEffect(() => {
    if (cfg) {
      setForm(hydrateForm(cfg));
      setEnabled(cfg.frappeEnabled);
    }
  }, [cfg]);

  const saveMut = useMutation(
    useCallback(async (body: Parameters<typeof updateFrappeConfig>[0]) => {
      return updateFrappeConfig(body);
    }, []),
  );
  const testMut = useMutation(useCallback(() => testFrappeConnection(), []));
  const rotateMut = useMutation(useCallback(() => rotateInboundSecret(), []));

  function onFieldChange<K extends keyof LocalForm>(key: K, v: string) {
    setForm((prev) => ({ ...prev, [key]: v }));
  }

  async function onSave() {
    try {
      await saveMut.execute({
        frappeEnabled: enabled,
        frappeBaseUrl: form.frappeBaseUrl || null,
        apiKey: form.apiKey || undefined,
        apiSecret: form.apiSecret || undefined,
        defaultIncomeAccount: form.defaultIncomeAccount || null,
        defaultReceivableAccount: form.defaultReceivableAccount || null,
        defaultBankAccount: form.defaultBankAccount || null,
        defaultModeOfPayment: form.defaultModeOfPayment || null,
        defaultCostCenter: form.defaultCostCenter || null,
        defaultCompany: form.defaultCompany || null,
      });
      toast.success('Frappe config saved');
      setForm((prev) => ({ ...prev, apiKey: '', apiSecret: '' }));
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Save failed');
    }
  }

  async function onTest() {
    try {
      const result = await testMut.execute();
      if (result.ok) {
        toast.success(`Connected as ${result.frappeUser || 'Frappe user'} (${result.latencyMs ?? '?'}ms)`);
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Test failed');
    }
  }

  async function onRotate() {
    setConfirmRotate(false);
    try {
      const result = await rotateMut.execute();
      setShowSecret({ secret: result.secret });
      refetch();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Rotation failed');
    }
  }

  function copySecret() {
    if (!showSecret) return;
    copy(showSecret.secret, 'Secret copied to clipboard');
  }

  // Setup checklist — computed locally from cfg. Items 4–6 (Frappe-side state)
  // flip to "needs verification" once Tier 2 adds backend probing.
  const checklist = [
    {
      label: 'Frappe URL set',
      done: !!cfg?.frappeBaseUrl,
    },
    {
      label: 'API Key + Secret stored',
      done: !!(cfg?.apiKeySet && cfg?.apiSecretSet),
    },
    {
      label: 'Account mapping complete',
      done: !!(
        cfg?.defaultCompany
        && cfg?.defaultIncomeAccount
        && cfg?.defaultReceivableAccount
        && cfg?.defaultBankAccount
        && cfg?.defaultModeOfPayment
      ),
    },
    {
      label: 'Inbound webhook secret generated',
      done: !!cfg?.inboundSecretSet,
    },
    {
      label: 'Last connection test passed',
      done: cfg?.lastTestStatus === 'success',
    },
    {
      label: 'Sync enabled',
      done: !!cfg?.frappeEnabled,
    },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Frappe config…</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Plug size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Frappe / ERPNext</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Sync fees and payments between the LMS and your Frappe books.
              </p>
              <a
                href="/docs/integrations/frappe"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
              >
                <BookOpen size={12} /> Setup guide <ExternalLink size={10} />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {cfg?.lastTestStatus === 'success' && (
              <Badge className="bg-green-50 text-green-700 border border-green-200">
                <Check size={12} className="mr-1" /> Last test OK
              </Badge>
            )}
            {cfg?.lastTestStatus === 'failed' && (
              <Badge className="bg-red-50 text-red-700 border border-red-200">
                <X size={12} className="mr-1" /> Last test failed
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Enabled</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
        </div>
        {cfg?.lastTestError && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg p-2">
            <AlertTriangle size={12} className="inline mr-1" />
            {cfg.lastTestError}
          </div>
        )}
      </div>

      {/* Setup wizard launcher — primary CTA for new/incomplete setups */}
      {!cfg?.frappeEnabled && (
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-primary flex items-center gap-2">
              <Sparkles size={16} /> Set up Frappe in 6 quick steps
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {cfg?.frappeBaseUrl
                ? 'Pick up where you left off — the wizard skips the steps you\u2019ve already done.'
                : 'Our wizard connects to your Frappe, installs the required fields, registers the webhook, and runs a safe test. No Frappe UI clicks needed.'}
            </p>
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 flex-shrink-0"
          >
            <Sparkles size={14} />
            {cfg?.frappeBaseUrl ? 'Resume setup' : 'Start setup'}
          </button>
        </div>
      )}

      {/* Your webhook details — institute ID + pre-built URL, auto-populated */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-primary" />
          <h3 className="font-semibold text-primary">Your webhook details</h3>
          <span className="text-xs text-gray-400">(paste these into Frappe)</span>
        </div>

        <div className="space-y-2.5">
          <CopyRow
            label="Institute ID"
            value={instituteId || '— loading —'}
            disabled={!instituteId}
            onCopy={() => instituteId && copy(instituteId, 'Institute ID copied')}
          />
          <CopyRow
            label="Webhook URL (Frappe → LMS)"
            value={webhookUrl || '— loading —'}
            disabled={!webhookUrl}
            onCopy={() => webhookUrl && copy(webhookUrl, 'Webhook URL copied')}
            mono
          />
        </div>

        <p className="text-[11px] text-gray-400">
          Open your Frappe Webhook record → paste the URL above as{' '}
          <span className="font-medium text-gray-500">Request URL</span> → enable{' '}
          <span className="font-medium text-gray-500">Enable Security</span> → paste your inbound
          secret → save.
        </p>
      </div>

      {/* Setup checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-primary">Setup progress</h3>
          <span className="text-xs text-gray-500">
            {checklistDone}/{checklist.length} complete
          </span>
        </div>
        <ul className="space-y-1.5">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <Check size={14} className="text-green-600 flex-shrink-0" />
              ) : (
                <Circle size={14} className="text-gray-300 flex-shrink-0" />
              )}
              <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Connection form */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 space-y-4">
        <h3 className="font-semibold text-primary">Connection</h3>

        <Field
          label="Frappe URL"
          hint="Must be HTTPS. Example: https://erp.yourinstitute.com"
          value={form.frappeBaseUrl}
          onChange={(v) => onFieldChange('frappeBaseUrl', v)}
          placeholder="https://erp.example.com"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="API Key"
            hint={cfg?.apiKeySet ? 'Already set — leave blank to keep existing' : 'Required'}
            type="password"
            value={form.apiKey}
            onChange={(v) => onFieldChange('apiKey', v)}
            placeholder={cfg?.apiKeySet ? '•••••••••• (stored)' : ''}
          />
          <Field
            label="API Secret"
            hint={cfg?.apiSecretSet ? 'Already set — leave blank to keep existing' : 'Required'}
            type="password"
            value={form.apiSecret}
            onChange={(v) => onFieldChange('apiSecret', v)}
            placeholder={cfg?.apiSecretSet ? '•••••••••• (stored)' : ''}
          />
        </div>
      </div>

      {/* Account mapping */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-primary">Accounting defaults</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            These GL accounts are used for every Sales Invoice + Payment Entry we push to Frappe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Company"
            hint="Exact company name in Frappe (e.g. Your Institute Pvt Ltd)"
            value={form.defaultCompany}
            onChange={(v) => onFieldChange('defaultCompany', v)}
          />
          <Field
            label="Mode of Payment"
            hint="e.g. Cash, Bank Transfer"
            value={form.defaultModeOfPayment}
            onChange={(v) => onFieldChange('defaultModeOfPayment', v)}
          />
          <Field
            label="Income Account"
            hint="Fee revenue GL (e.g. 4100 - Fee Income - YIP)"
            value={form.defaultIncomeAccount}
            onChange={(v) => onFieldChange('defaultIncomeAccount', v)}
          />
          <Field
            label="Receivable Account"
            hint="Debtors GL (e.g. 1310 - Sundry Debtors - YIP)"
            value={form.defaultReceivableAccount}
            onChange={(v) => onFieldChange('defaultReceivableAccount', v)}
          />
          <Field
            label="Bank / Cash Account"
            hint="Where received payments land (e.g. 1118 - Bank Al Habib - MITT). Must be a balance-sheet asset, not an income account."
            value={form.defaultBankAccount}
            onChange={(v) => onFieldChange('defaultBankAccount', v)}
          />
          <Field
            label="Cost Center (optional)"
            hint="Leave blank to use Frappe default"
            value={form.defaultCostCenter}
            onChange={(v) => onFieldChange('defaultCostCenter', v)}
          />
        </div>
      </div>

      {/* Inbound webhook secret */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-primary flex items-center gap-2">
              <Key size={16} /> Inbound webhook secret
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-lg">
              Frappe signs inbound Payment Entry webhooks with this secret. Share it with your
              Frappe admin. Lost it? Rotate and update the Frappe Webhook record.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Status: {cfg?.inboundSecretSet ? (
                <span className="text-green-600 font-medium">Set</span>
              ) : (
                <span className="text-amber-600 font-medium">Not generated yet</span>
              )}
            </p>
          </div>
          {cfg?.inboundSecretSet ? (
            <button
              onClick={() => setConfirmRotate(true)}
              disabled={rotateMut.loading}
              className="inline-flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
            >
              {rotateMut.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Rotate secret
            </button>
          ) : (
            <button
              onClick={onRotate}
              disabled={rotateMut.loading}
              className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {rotateMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              Generate secret
            </button>
          )}
        </div>
      </div>

      {/* Save + Test row */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saveMut.loading}
          className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMut.loading && <Loader2 size={14} className="animate-spin" />}
          Save changes
        </button>
        <button
          onClick={onTest}
          disabled={testMut.loading || !cfg?.apiKeySet || !cfg?.apiSecretSet || !form.frappeBaseUrl}
          className="inline-flex items-center gap-2 border border-gray-200 text-primary rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          title={!cfg?.apiKeySet ? 'Set credentials first, then save' : ''}
        >
          {testMut.loading && <Loader2 size={14} className="animate-spin" />}
          Test connection
        </button>
      </div>

      {/* Advanced — manual setup snippets */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Code size={16} className="text-gray-500" />
            <h3 className="font-semibold text-primary">Advanced — manual Frappe setup</h3>
            <span className="text-xs text-gray-400">(only needed if you skip the connector app)</span>
          </div>
          {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-700">
                  Custom fields (paste into Frappe manually)
                </span>
              </div>
              <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-[11px] whitespace-pre-wrap">
                {getCustomFieldFixture()}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-700">
                  HMAC signing script (for Frappe Webhook server-script)
                </span>
                {cfg?.inboundSecretSet && (
                  <button
                    onClick={() => copy(
                      getHmacServerScript('<paste-your-secret-here>'),
                      'HMAC script copied — replace the secret placeholder with the real one',
                    )}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Copy size={11} /> Copy
                  </button>
                )}
              </div>
              <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-[11px] whitespace-pre-wrap max-h-60 overflow-auto">
                {getHmacServerScript('<paste-your-secret-here>')}
              </pre>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Only needed if you&apos;re NOT using Frappe&apos;s built-in &quot;Enable Security&quot;
                checkbox. For most institutes, enabling security on the Webhook record is simpler.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rotate confirm */}
      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate inbound secret?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the existing secret. Any Frappe webhook using it will
              start failing with 401 until you open the Frappe Webhook record and paste the new
              secret. You&apos;ll see the new secret <strong>once</strong> — copy it to a password
              manager before closing the dialog. Only rotate if you suspect the current secret has
              leaked or you&apos;ve lost it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRotate}>Rotate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Setup wizard */}
      <FrappeSetupWizard
        open={wizardOpen}
        initialCfg={cfg || null}
        onClose={(didComplete) => {
          setWizardOpen(false);
          if (didComplete) refetch();
        }}
      />

      {/* One-time secret display */}
      <Dialog open={!!showSecret} onOpenChange={(o) => { if (!o) setShowSecret(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New inbound webhook secret</DialogTitle>
            <DialogDescription>
              Copy this value now. You won&apos;t be able to see it again — rotating again will invalidate
              it.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs break-all">
            {showSecret?.secret}
          </div>
          <DialogFooter>
            <button
              onClick={copySecret}
              className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              <Copy size={14} /> Copy to clipboard
            </button>
            <button
              onClick={() => setShowSecret(null)}
              className="inline-flex items-center gap-2 border border-gray-200 text-primary rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              I&apos;ve saved it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyRow({
  label, value, onCopy, disabled, mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-gray-500 mb-0.5">{label}</div>
        <div
          className={`bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs truncate ${
            mono ? 'font-mono' : ''
          } ${disabled ? 'text-gray-400' : 'text-gray-700'}`}
          title={value}
        >
          {value}
        </div>
      </div>
      <button
        onClick={onCopy}
        disabled={disabled}
        className="inline-flex items-center gap-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed mt-4"
        aria-label={`Copy ${label}`}
      >
        <Copy size={12} />
        Copy
      </button>
    </div>
  );
}

function Field({
  label, hint, value, onChange, type = 'text', placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      {hint && <span className="text-[11px] text-gray-400 mt-1 block">{hint}</span>}
    </label>
  );
}
