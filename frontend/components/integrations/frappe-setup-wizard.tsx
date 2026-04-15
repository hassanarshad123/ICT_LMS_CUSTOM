'use client';

/**
 * Self-service Frappe setup wizard — 6 steps.
 *
 * Goal: non-technical admin goes from zero to a working two-way sync without
 * ever touching Frappe's UI. Backend does the heavy lifting (creating Custom
 * Field / Webhook / Customer records via Frappe's REST API). This component
 * drives the flow, shows progress, and recovers from partial completion.
 *
 * Step map:
 *   1. Connect     — URL + API creds, POST /frappe/test
 *   2. Accounts    — introspected dropdowns, POST /frappe (update config)
 *   3. Fields      — POST /setup/custom-fields
 *   4. Webhook     — POST /setup/webhook (also auto-generates inbound secret)
 *   5. Dry-run     — POST /setup/dry-run
 *   6. Enable      — flip frappe_enabled=true, close wizard
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useMutation } from '@/hooks/use-api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Check, Loader2, ArrowLeft, ArrowRight, X, AlertTriangle, RefreshCw, Sparkles,
} from 'lucide-react';
import {
  type FrappeConfig,
  getFrappeConfig, updateFrappeConfig, testFrappeConnection,
  introspectFrappe, installCustomFields, registerWebhook, runDryRun,
  setAutoCreateCustomers,
  type DropdownItem,
} from '@/lib/api/integrations';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS = ['Connect', 'Accounts', 'Fields', 'Webhook', 'Test sync', 'Enable'];

interface LocalForm {
  frappeBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  defaultCompany: string;
  defaultIncomeAccount: string;
  defaultReceivableAccount: string;
  defaultBankAccount: string;
  defaultModeOfPayment: string;
  defaultCostCenter: string;
  autoCreateCustomers: boolean;
}

const BLANK_FORM: LocalForm = {
  frappeBaseUrl: '',
  apiKey: '',
  apiSecret: '',
  defaultCompany: '',
  defaultIncomeAccount: '',
  defaultReceivableAccount: '',
  defaultBankAccount: '',
  defaultModeOfPayment: '',
  defaultCostCenter: '',
  autoCreateCustomers: true,
};

function hydrateForm(cfg: FrappeConfig | null): LocalForm {
  if (!cfg) return BLANK_FORM;
  return {
    frappeBaseUrl: cfg.frappeBaseUrl || '',
    apiKey: '',
    apiSecret: '',
    defaultCompany: cfg.defaultCompany || '',
    defaultIncomeAccount: cfg.defaultIncomeAccount || '',
    defaultReceivableAccount: cfg.defaultReceivableAccount || '',
    defaultBankAccount: cfg.defaultBankAccount || '',
    defaultModeOfPayment: cfg.defaultModeOfPayment || '',
    defaultCostCenter: cfg.defaultCostCenter || '',
    autoCreateCustomers: cfg.autoCreateCustomers ?? true,
  };
}

export default function FrappeSetupWizard({
  open, onClose, initialCfg,
}: {
  open: boolean;
  onClose: (didComplete: boolean) => void;
  initialCfg: FrappeConfig | null;
}) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<LocalForm>(() => hydrateForm(initialCfg));
  const [cfg, setCfg] = useState<FrappeConfig | null>(initialCfg);

  // Step 2 dropdown data
  const [companies, setCompanies] = useState<DropdownItem[]>([]);
  const [incomeAccounts, setIncomeAccounts] = useState<DropdownItem[]>([]);
  const [receivableAccounts, setReceivableAccounts] = useState<DropdownItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<DropdownItem[]>([]);
  const [modesOfPayment, setModesOfPayment] = useState<DropdownItem[]>([]);
  const [costCenters, setCostCenters] = useState<DropdownItem[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Step results (useMutation doesn't surface last result so we cache locally)
  const [installResult, setInstallResult] = useState<Awaited<ReturnType<typeof installCustomFields>> | null>(null);
  const [webhookResult, setWebhookResult] = useState<Awaited<ReturnType<typeof registerWebhook>> | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{ ok: boolean; message: string; invoiceName?: string } | null>(null);

  const saveMut = useMutation(useCallback((body: Parameters<typeof updateFrappeConfig>[0]) => updateFrappeConfig(body), []));
  const testMut = useMutation(useCallback(() => testFrappeConnection(), []));
  const installMut = useMutation(useCallback(() => installCustomFields(), []));
  const webhookMut = useMutation(useCallback(() => registerWebhook(), []));
  const dryRunMut = useMutation(useCallback(() => runDryRun(), []));

  function update<K extends keyof LocalForm>(key: K, v: LocalForm[K]) {
    setForm((p) => ({ ...p, [key]: v }));
  }

  // Reset when modal opens fresh
  useEffect(() => {
    if (open) {
      setForm(hydrateForm(initialCfg));
      setCfg(initialCfg);
      // Resume at the right step based on config state
      const c = initialCfg;
      if (!c || !c.frappeBaseUrl || !c.apiKeySet || !c.apiSecretSet) setStep(1);
      else if (c.lastTestStatus !== 'success') setStep(1);
      else if (!c.defaultCompany || !c.defaultBankAccount) setStep(2);
      else if (!c.inboundSecretSet) setStep(3);
      else if (!c.frappeEnabled) setStep(6);
      else setStep(6);
      setDryRunResult(null);
    }
  }, [open, initialCfg]);

  // Load dropdowns when entering step 2
  useEffect(() => {
    if (!open || step !== 2 || !cfg?.apiKeySet || !cfg?.apiSecretSet) return;
    let cancelled = false;
    (async () => {
      setLoadingDropdowns(true);
      try {
        const [c, m] = await Promise.all([
          introspectFrappe('companies'),
          introspectFrappe('modes-of-payment'),
        ]);
        if (cancelled) return;
        setCompanies(c.items);
        setModesOfPayment(m.items);
      } catch (e) {
        if (!cancelled) toast.error(
          e instanceof ApiError ? `Couldn't load dropdowns: ${e.message}` : 'Failed to load Frappe data',
        );
      } finally {
        if (!cancelled) setLoadingDropdowns(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, step, cfg?.apiKeySet, cfg?.apiSecretSet]);

  // Load company-scoped dropdowns when company changes
  useEffect(() => {
    if (step !== 2 || !form.defaultCompany) return;
    let cancelled = false;
    (async () => {
      try {
        const [inc, recv, bank, cc] = await Promise.all([
          introspectFrappe('accounts', { company: form.defaultCompany, accountType: 'Income Account' }),
          introspectFrappe('accounts', { company: form.defaultCompany, accountType: 'Receivable' }),
          introspectFrappe('accounts', { company: form.defaultCompany, accountType: 'Bank' }),
          introspectFrappe('cost-centers', { company: form.defaultCompany }),
        ]);
        if (cancelled) return;
        setIncomeAccounts(inc.items);
        setReceivableAccounts(recv.items);
        // Bank accounts: Frappe "Bank" and "Cash" account types — merge.
        const cash = await introspectFrappe('accounts', { company: form.defaultCompany, accountType: 'Cash' });
        setBankAccounts([...bank.items, ...cash.items]);
        setCostCenters(cc.items);
      } catch (e) {
        if (!cancelled) toast.error(
          e instanceof ApiError ? e.message : 'Failed to load accounts',
        );
      }
    })();
    return () => { cancelled = true; };
  }, [step, form.defaultCompany]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return !!form.frappeBaseUrl && (cfg?.apiKeySet || !!form.apiKey) && (cfg?.apiSecretSet || !!form.apiSecret) && cfg?.lastTestStatus === 'success';
      case 2: return !!(form.defaultCompany && form.defaultIncomeAccount
        && form.defaultReceivableAccount && form.defaultBankAccount && form.defaultModeOfPayment);
      case 3: return !!installResult?.ok;
      case 4: return !!webhookResult?.ok;
      case 5: return dryRunResult?.ok === true;
      default: return true;
    }
  }, [step, form, cfg, installResult, webhookResult, dryRunResult]);

  async function saveCurrentForm() {
    const updated = await saveMut.execute({
      frappeEnabled: cfg?.frappeEnabled ?? false,
      frappeBaseUrl: form.frappeBaseUrl || null,
      apiKey: form.apiKey || undefined,
      apiSecret: form.apiSecret || undefined,
      defaultCompany: form.defaultCompany || null,
      defaultIncomeAccount: form.defaultIncomeAccount || null,
      defaultReceivableAccount: form.defaultReceivableAccount || null,
      defaultBankAccount: form.defaultBankAccount || null,
      defaultModeOfPayment: form.defaultModeOfPayment || null,
      defaultCostCenter: form.defaultCostCenter || null,
      autoCreateCustomers: form.autoCreateCustomers,
    });
    setCfg(updated);
    setForm((p) => ({ ...p, apiKey: '', apiSecret: '' }));
    return updated;
  }

  async function onTestConnection() {
    try {
      await saveCurrentForm();
      const r = await testMut.execute();
      const latest = await getFrappeConfig();
      setCfg(latest);
      if (r.ok) toast.success(`Connected as ${r.frappeUser || 'Frappe user'}`);
      else toast.error(`Couldn't connect: ${r.message}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Test failed');
    }
  }

  async function onInstallFields() {
    try {
      const r = await installMut.execute();
      setInstallResult(r);
      toast.success(r.message);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Installation failed');
    }
  }

  async function onRegisterWebhook() {
    try {
      const r = await webhookMut.execute();
      setWebhookResult(r);
      toast.success(r.message);
      setCfg(await getFrappeConfig());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Webhook registration failed');
    }
  }

  async function onDryRun() {
    try {
      const r = await dryRunMut.execute();
      setDryRunResult({ ok: r.ok, message: r.message, invoiceName: r.invoiceName });
      if (r.ok) toast.success('Dry-run passed');
      else toast.error(r.message);
    } catch (e) {
      setDryRunResult({ ok: false, message: e instanceof ApiError ? e.message : 'Dry-run failed' });
    }
  }

  async function onEnable() {
    try {
      await setAutoCreateCustomers(form.autoCreateCustomers);
      await saveMut.execute({
        frappeEnabled: true,
        autoCreateCustomers: form.autoCreateCustomers,
      });
      toast.success('Frappe sync enabled. Fee plans now push to your Frappe in real time.');
      onClose(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to enable sync');
    }
  }

  function goNext() { if (step < 6) setStep((s) => (s + 1) as Step); }
  function goBack() { if (step > 1) setStep((s) => (s - 1) as Step); }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(false); }}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              Set up Frappe
            </DialogTitle>
            <button
              onClick={() => onClose(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <StepIndicator current={step} total={6} labels={STEP_LABELS} />
        </DialogHeader>

        <div className="px-6 py-5 min-h-[420px] max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <Step1Connect form={form} cfg={cfg} onChange={update} onTest={onTestConnection}
              testing={testMut.loading || saveMut.loading} />
          )}
          {step === 2 && (
            <Step2Accounts
              form={form} onChange={update}
              companies={companies} incomeAccounts={incomeAccounts}
              receivableAccounts={receivableAccounts} bankAccounts={bankAccounts}
              modesOfPayment={modesOfPayment} costCenters={costCenters}
              loading={loadingDropdowns}
              onSave={saveCurrentForm}
              saving={saveMut.loading}
            />
          )}
          {step === 3 && (
            <Step3Fields
              onInstall={onInstallFields}
              loading={installMut.loading}
              result={installResult}
            />
          )}
          {step === 4 && (
            <Step4Webhook
              onRegister={onRegisterWebhook}
              loading={webhookMut.loading}
              result={webhookResult}
            />
          )}
          {step === 5 && (
            <Step5DryRun
              onRun={onDryRun}
              loading={dryRunMut.loading}
              result={dryRunResult}
            />
          )}
          {step === 6 && (
            <Step6Enable
              autoCreateCustomers={form.autoCreateCustomers}
              onToggleAutoCreate={(v) => update('autoCreateCustomers', v)}
              onEnable={onEnable}
              loading={saveMut.loading}
              cfg={cfg}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={goBack}
            disabled={step === 1}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} /> Back
          </button>
          {step < 6 && (
            <button
              onClick={async () => {
                if (step === 2) await saveCurrentForm();
                goNext();
              }}
              disabled={!canAdvance || saveMut.loading}
              className="inline-flex items-center gap-1.5 bg-primary text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step components ──────────────────────────────────────────────

function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-1 mt-3">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 ${
                done ? 'bg-green-100 text-green-700'
                  : active ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? <Check size={12} /> : n}
              </div>
              <span className={`text-[11px] truncate ${active ? 'text-primary font-medium' : 'text-gray-500'}`}>
                {labels[n - 1]}
              </span>
            </div>
            {n < total && <div className="h-px bg-gray-200 flex-1 mx-1.5" />}
          </div>
        );
      })}
    </div>
  );
}

function Step1Connect({ form, cfg, onChange, onTest, testing }: {
  form: LocalForm; cfg: FrappeConfig | null;
  onChange: <K extends keyof LocalForm>(key: K, v: LocalForm[K]) => void;
  onTest: () => void; testing: boolean;
}) {
  return (
    <div className="space-y-4">
      <Intro title="Step 1 — Connect to your Frappe"
        description="Paste your ERPNext URL and the API credentials for the dedicated LMS sync user. We'll verify the connection before moving on." />

      <TextField label="Frappe URL" hint="HTTPS required. Example: https://erp.yourinstitute.com"
        value={form.frappeBaseUrl} onChange={(v) => onChange('frappeBaseUrl', v)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="API Key" type="password"
          hint={cfg?.apiKeySet ? 'Already set — leave blank to keep existing' : 'Generate in Frappe: User > API Access'}
          value={form.apiKey} onChange={(v) => onChange('apiKey', v)}
          placeholder={cfg?.apiKeySet ? '•••••••••• (stored)' : ''} />
        <TextField label="API Secret" type="password"
          hint={cfg?.apiSecretSet ? 'Already set — leave blank to keep existing' : 'Shown once in Frappe on generation'}
          value={form.apiSecret} onChange={(v) => onChange('apiSecret', v)}
          placeholder={cfg?.apiSecretSet ? '•••••••••• (stored)' : ''} />
      </div>

      <button
        onClick={onTest}
        disabled={testing || !form.frappeBaseUrl}
        className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {testing && <Loader2 size={14} className="animate-spin" />}
        Save & Test connection
      </button>

      {cfg?.lastTestStatus === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">
          <Check size={16} /> Connected successfully. You can click Next.
        </div>
      )}
      {cfg?.lastTestStatus === 'failed' && cfg?.lastTestError && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{cfg.lastTestError}</span>
        </div>
      )}
    </div>
  );
}

function Step2Accounts({ form, onChange, companies, incomeAccounts, receivableAccounts,
  bankAccounts, modesOfPayment, costCenters, loading, onSave, saving }: {
  form: LocalForm;
  onChange: <K extends keyof LocalForm>(key: K, v: LocalForm[K]) => void;
  companies: DropdownItem[]; incomeAccounts: DropdownItem[]; receivableAccounts: DropdownItem[];
  bankAccounts: DropdownItem[]; modesOfPayment: DropdownItem[]; costCenters: DropdownItem[];
  loading: boolean; onSave: () => Promise<FrappeConfig>; saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <Intro title="Step 2 — Map your accounts"
        description="Pick the GL accounts the LMS should post fee invoices and payments to. Dropdowns are populated from your Frappe — if you don't see the right account, check that your Company is set correctly." />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" /> Loading your Frappe data…
        </div>
      )}

      <DropdownField label="Company" hint="Your Frappe Company name"
        value={form.defaultCompany} onChange={(v) => onChange('defaultCompany', v)}
        options={companies} />

      {form.defaultCompany && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DropdownField label="Income Account" hint="Fee revenue (P&L)"
              value={form.defaultIncomeAccount} onChange={(v) => onChange('defaultIncomeAccount', v)}
              options={incomeAccounts} />
            <DropdownField label="Receivable Account" hint="Debtors (balance sheet)"
              value={form.defaultReceivableAccount} onChange={(v) => onChange('defaultReceivableAccount', v)}
              options={receivableAccounts} />
            <DropdownField label="Bank / Cash Account" hint="Where received payments land"
              value={form.defaultBankAccount} onChange={(v) => onChange('defaultBankAccount', v)}
              options={bankAccounts} />
            <DropdownField label="Mode of Payment" hint="Default (Cash, Bank Transfer, etc.)"
              value={form.defaultModeOfPayment} onChange={(v) => onChange('defaultModeOfPayment', v)}
              options={modesOfPayment} />
            <DropdownField label="Cost Center (optional)" hint="Leave blank to use Frappe default"
              value={form.defaultCostCenter} onChange={(v) => onChange('defaultCostCenter', v)}
              options={costCenters} />
          </div>
        </>
      )}

      <button onClick={onSave} disabled={saving}
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50">
        {saving && <Loader2 size={12} className="animate-spin" />}
        Save selections
      </button>
    </div>
  );
}

function Step3Fields({ onInstall, loading, result }: {
  onInstall: () => void; loading: boolean;
  result: { ok: boolean; message: string; installed?: { doctype: string; fieldname: string }[]; skipped?: { doctype: string; fieldname: string }[] } | null | undefined;
}) {
  return (
    <div className="space-y-4">
      <Intro title="Step 3 — Install tracking fields in Frappe"
        description="The LMS needs 3 custom fields on Sales Invoice + Payment Entry to link Frappe documents back to LMS fee plans. Click below and we'll add them for you through Frappe's API." />

      <button onClick={onInstall} disabled={loading || result?.ok}
        className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
        {loading && <Loader2 size={14} className="animate-spin" />}
        {result?.ok ? 'Installed' : 'Install fields'}
      </button>

      {result?.ok && (
        <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">
          <Check size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{result.message}</div>
            {result.installed && result.installed.length > 0 && (
              <ul className="mt-1 text-xs text-green-700/80 space-y-0.5">
                {result.installed.map((f) => (
                  <li key={`${f.doctype}:${f.fieldname}`}>✓ {f.doctype} → {f.fieldname}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Step4Webhook({ onRegister, loading, result }: {
  onRegister: () => void; loading: boolean;
  result: { ok: boolean; message: string; webhookName?: string } | null | undefined;
}) {
  return (
    <div className="space-y-4">
      <Intro title="Step 4 — Register the webhook"
        description="This creates a Webhook record in your Frappe pointing back to the LMS. It fires every time someone records a Payment Entry in Frappe, so cash-ledger payments flip LMS installments to paid automatically." />

      <button onClick={onRegister} disabled={loading || result?.ok}
        className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
        {loading && <Loader2 size={14} className="animate-spin" />}
        {result?.ok ? 'Registered' : 'Register webhook'}
      </button>

      {result?.ok && (
        <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3">
          <Check size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{result.message}</div>
            {result.webhookName && (
              <div className="text-xs text-green-700/80 mt-1">Webhook name: <code className="font-mono">{result.webhookName}</code></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Step5DryRun({ onRun, loading, result }: {
  onRun: () => void; loading: boolean;
  result: { ok: boolean; message: string; invoiceName?: string } | null;
}) {
  return (
    <div className="space-y-4">
      <Intro title="Step 5 — Run a test sync"
        description="We'll create a ₨1 test Sales Invoice against a namespaced test customer and immediately cancel it. This proves all your account mappings work together before you enable real sync." />

      <button onClick={onRun} disabled={loading}
        className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {result?.ok ? 'Run again' : 'Run test sync'}
      </button>

      {result && (
        <div className={`flex items-start gap-2 text-sm border rounded-xl p-3 ${
          result.ok ? 'text-green-700 bg-green-50 border-green-200'
            : 'text-red-700 bg-red-50 border-red-200'
        }`}>
          {result.ok ? <Check size={16} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
          <div>
            <div className="font-medium">{result.message}</div>
            {result.invoiceName && (
              <div className="text-xs mt-1">Test invoice <code className="font-mono">{result.invoiceName}</code> was created and cancelled.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Step6Enable({ autoCreateCustomers, onToggleAutoCreate, onEnable, loading, cfg }: {
  autoCreateCustomers: boolean; onToggleAutoCreate: (v: boolean) => void;
  onEnable: () => void; loading: boolean; cfg: FrappeConfig | null;
}) {
  return (
    <div className="space-y-4">
      <Intro title="Step 6 — Enable sync"
        description="Final step. Once enabled, every fee plan you create pushes to your Frappe within 30 seconds. Payment Entries created in Frappe flip LMS installments to paid automatically." />

      <label className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 cursor-pointer">
        <input type="checkbox" checked={autoCreateCustomers}
          onChange={(e) => onToggleAutoCreate(e.target.checked)}
          className="mt-0.5" />
        <div>
          <div className="text-sm font-medium text-gray-700">Auto-create Customers in Frappe</div>
          <div className="text-xs text-gray-500 mt-0.5">
            When a student doesn&apos;t have a matching Frappe Customer yet, the LMS creates one
            using the student&apos;s name and email. Leave on unless you manage Customers manually.
          </div>
        </div>
      </label>

      <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-xl p-4">
        <div><strong>Frappe URL:</strong> {cfg?.frappeBaseUrl}</div>
        <div><strong>Company:</strong> {cfg?.defaultCompany}</div>
        <div><strong>Income / Receivable / Bank:</strong> {cfg?.defaultIncomeAccount} / {cfg?.defaultReceivableAccount} / {cfg?.defaultBankAccount}</div>
        <div><strong>Auto-create Customers:</strong> {autoCreateCustomers ? 'Yes' : 'No'}</div>
      </div>

      <button onClick={onEnable} disabled={loading}
        className="inline-flex items-center gap-2 bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
        {loading && <Loader2 size={14} className="animate-spin" />}
        Enable Frappe sync
      </button>
    </div>
  );
}

// ─── Primitives ────────────────────────────────────────────────────

function Intro({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h4 className="font-semibold text-primary text-base">{title}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}

function TextField({ label, hint, value, onChange, type = 'text', placeholder }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      {hint && <span className="text-[11px] text-gray-400 mt-1 block">{hint}</span>}
    </label>
  );
}

function DropdownField({ label, hint, value, onChange, options }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; options: DropdownItem[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.name} value={o.name}>{o.name}</option>
        ))}
      </select>
      {hint && <span className="text-[11px] text-gray-400 mt-1 block">{hint}</span>}
    </label>
  );
}
