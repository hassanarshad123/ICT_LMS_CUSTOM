'use client';

import { useState, useRef } from 'react';
import { Save, Plus, Trash2, Upload } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getSAProfile, updateSAProfile, uploadSALogo,
  getPaymentMethods, updatePaymentMethods,
  type SAProfile, type PaymentMethodItem,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';

const METHOD_TYPES = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'custom', label: 'Custom' },
];

export default function SASettingsPage() {
  const { data: profile, refetch: refetchProfile } = useApi<SAProfile>(() => getSAProfile(), []);
  const { data: payData, refetch: refetchPay } = useApi(() => getPaymentMethods(), []);

  const [form, setForm] = useState<Partial<SAProfile>>({});
  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Initialize form when data loads
  if (profile && !initialized) {
    setForm(profile);
    setMethods(payData?.methods || []);
    setInitialized(true);
  }

  const { execute: doUpdateProfile, loading: savingProfile } = useMutation(
    (data: Partial<SAProfile>) => updateSAProfile(data),
  );
  const { execute: doUploadLogo } = useMutation(
    (logo: string) => uploadSALogo(logo),
  );
  const { execute: doUpdateMethods, loading: savingMethods } = useMutation(
    (m: PaymentMethodItem[]) => updatePaymentMethods(m),
  );

  const handleSaveProfile = async () => {
    try {
      await doUpdateProfile(form);
      toast.success('Profile saved');
      refetchProfile();
    } catch { toast.error('Failed to save'); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        await doUploadLogo(dataUrl);
        setForm({ ...form, companyLogo: dataUrl });
        toast.success('Logo uploaded');
        refetchProfile();
      } catch { toast.error('Failed to upload logo'); }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMethods = async () => {
    try {
      await doUpdateMethods(methods);
      toast.success('Payment methods saved');
      refetchPay();
    } catch { toast.error('Failed to save'); }
  };

  const addMethod = () => {
    setMethods([...methods, { type: 'bank_transfer', label: 'Bank Account', details: {} }]);
  };

  const removeMethod = (idx: number) => {
    setMethods(methods.filter((_, i) => i !== idx));
  };

  const updateMethod = (idx: number, updates: Partial<PaymentMethodItem>) => {
    setMethods(methods.map((m, i) => i === idx ? { ...m, ...updates } : m));
  };

  const updateDetail = (idx: number, key: string, value: string) => {
    setMethods(methods.map((m, i) =>
      i === idx ? { ...m, details: { ...m.details, [key]: value } } : m
    ));
  };

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Business profile and payment details for invoices</p>
      </div>

      {/* Business Profile */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 space-y-4">
        <h2 className="font-semibold text-zinc-900">Business Profile</h2>
        <p className="text-xs text-zinc-500">This information appears on invoices you generate.</p>

        {/* Logo */}
        <div className="flex items-center gap-4">
          {form.companyLogo ? (
            <img src={form.companyLogo} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-zinc-200" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400">
              <Upload size={20} />
            </div>
          )}
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
            >
              Upload Logo
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <p className="text-xs text-zinc-400 mt-1">PNG or JPG, max 1MB</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Company Name</label>
            <input type="text" value={form.companyName || ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" placeholder="Zensbot Pvt Ltd" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Email</label>
            <input type="email" value={form.companyEmail || ''} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" placeholder="billing@zensbot.com" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Phone</label>
            <input type="text" value={form.companyPhone || ''} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" placeholder="+92 300 1234567" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Address</label>
            <input type="text" value={form.companyAddress || ''} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" placeholder="123 Main St, Karachi" />
          </div>
        </div>

        <button onClick={handleSaveProfile} disabled={savingProfile} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#1A1A1A] text-white rounded-xl disabled:opacity-40">
          <Save size={16} /> {savingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Payment Methods */}
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900">Payment Methods</h2>
            <p className="text-xs text-zinc-500">These appear on invoices so institutes know how to pay.</p>
          </div>
          <button onClick={addMethod} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 rounded-lg">
            <Plus size={14} /> Add Method
          </button>
        </div>

        {methods.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-4">No payment methods configured. Add one to show on invoices.</p>
        )}

        {methods.map((method, idx) => (
          <div key={idx} className="border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <select
                  value={method.type}
                  onChange={(e) => updateMethod(idx, { type: e.target.value })}
                  className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
                >
                  {METHOD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input
                  type="text" value={method.label}
                  onChange={(e) => updateMethod(idx, { label: e.target.value })}
                  className="text-sm border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="Display label"
                />
              </div>
              <button onClick={() => removeMethod(idx)} className="p-1 text-red-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>

            {method.type === 'bank_transfer' && (
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={method.details.bank_name || ''} onChange={(e) => updateDetail(idx, 'bank_name', e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="Bank Name (e.g., HBL)" />
                <input type="text" value={method.details.account_title || ''} onChange={(e) => updateDetail(idx, 'account_title', e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="Account Title" />
                <input type="text" value={method.details.account_number || ''} onChange={(e) => updateDetail(idx, 'account_number', e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="Account Number" />
                <input type="text" value={method.details.iban || ''} onChange={(e) => updateDetail(idx, 'iban', e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="IBAN" />
              </div>
            )}
            {(method.type === 'jazzcash' || method.type === 'easypaisa') && (
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={method.details.phone || ''} onChange={(e) => updateDetail(idx, 'phone', e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="Phone Number" />
                <input type="text" value={method.details.account_title || ''} onChange={(e) => updateDetail(idx, 'account_title', e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="Account Title" />
              </div>
            )}
            {method.type === 'custom' && (
              <input type="text" value={method.details.instructions || ''} onChange={(e) => updateDetail(idx, 'instructions', e.target.value)} className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5" placeholder="Custom payment instructions" />
            )}
          </div>
        ))}

        <button onClick={handleSaveMethods} disabled={savingMethods} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#1A1A1A] text-white rounded-xl disabled:opacity-40">
          <Save size={16} /> {savingMethods ? 'Saving...' : 'Save Payment Methods'}
        </button>
      </div>
    </div>
  );
}
