'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useApi, useMutation } from '@/hooks/use-api';
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
} from 'lucide-react';
import {
  getFrappeConfig, updateFrappeConfig, testFrappeConnection, rotateInboundSecret,
  type FrappeConfig,
} from '@/lib/api/integrations';

type LocalForm = {
  frappeBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  defaultIncomeAccount: string;
  defaultReceivableAccount: string;
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
    defaultModeOfPayment: cfg.defaultModeOfPayment || '',
    defaultCostCenter: cfg.defaultCostCenter || '',
    defaultCompany: cfg.defaultCompany || '',
  };
}

export default function FrappeTab() {
  const { data: cfg, loading, error, refetch } = useApi(getFrappeConfig, []);
  const [form, setForm] = useState<LocalForm>(BLANK_FORM);
  const [enabled, setEnabled] = useState(false);
  const [showSecret, setShowSecret] = useState<{ secret: string } | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);

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
    navigator.clipboard.writeText(showSecret.secret);
    toast.success('Secret copied to clipboard');
  }

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
          <button
            onClick={() => setConfirmRotate(true)}
            disabled={rotateMut.loading}
            className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {rotateMut.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {cfg?.inboundSecretSet ? 'Rotate secret' : 'Generate secret'}
          </button>
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

      {/* Rotate confirm */}
      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate inbound secret?</AlertDialogTitle>
            <AlertDialogDescription>
              The current secret will stop working immediately. Frappe webhook records using it will
              fail until you update them with the new secret. You&apos;ll see the new secret once —
              copy it right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRotate}>Rotate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
