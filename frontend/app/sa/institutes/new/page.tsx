'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createInstitute, createAdminForInstitute, type PlanTier } from '@/lib/api/super-admin';
import { toast } from 'sonner';
import Link from 'next/link';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function NewInstitutePage() {
  const router = useRouter();
  const [step, setStep] = useState<'institute' | 'admin'>('institute');
  const [instituteId, setInstituteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    planTier: 'free',
    maxUsers: 50,
    maxStudents: 15,
    maxStorageGb: 10,
    maxVideoGb: 50,
    expiresAt: '',
  });

  const [adminForm, setAdminForm] = useState({
    email: '',
    name: '',
    password: '',
    phone: '',
  });

  const handleNameChange = (name: string) => {
    setForm((f) => ({ ...f, name, slug: slugify(name) }));
  };

  const handleCreateInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const inst = await createInstitute({
        name: form.name,
        slug: form.slug,
        contactEmail: form.contactEmail,
        planTier: form.planTier as PlanTier,
        maxUsers: form.maxUsers,
        maxStudents: form.maxStudents,
        maxStorageGb: form.maxStorageGb,
        maxVideoGb: form.maxVideoGb,
        expiresAt: form.expiresAt || null,
      });
      setInstituteId(inst.id);
      toast.success('Institute created! Now create the admin user.');
      setStep('admin');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create institute');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) return;
    setLoading(true);
    try {
      await createAdminForInstitute(instituteId, {
        email: adminForm.email,
        name: adminForm.name,
        password: adminForm.password,
        phone: adminForm.phone || undefined,
      });
      toast.success('Admin user created successfully!');
      router.push(`/sa/institutes/${instituteId}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/sa/institutes" className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Institute</h1>
          <p className="text-sm text-gray-500">
            Step {step === 'institute' ? '1' : '2'} of 2 &mdash; {step === 'institute' ? 'Institute Details' : 'Create Admin User'}
          </p>
        </div>
      </div>

      {step === 'institute' ? (
        <form onSubmit={handleCreateInstitute} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Institute Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                placeholder="Acme Institute"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (subdomain)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                required
                placeholder="acme"
                pattern="[a-z0-9-]+"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">{form.slug || 'slug'}.zensbot.online</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                required
                placeholder="contact@acme.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                value={form.planTier}
                onChange={(e) => setForm((f) => ({ ...f, planTier: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              >
                <optgroup label="Pricing v2">
                  <option value="professional">Professional — Free, Rs 80/mo per extra student</option>
                  <option value="custom">Custom — Quoted per deal</option>
                </optgroup>
                <optgroup label="Legacy">
                  <option value="free">Free (14-day trial)</option>
                  <option value="starter">Starter — Rs 2,500/mo</option>
                  <option value="basic">Basic — Rs 5,000/mo</option>
                  <option value="pro">Pro — Rs 15,000/mo</option>
                  <option value="enterprise">Enterprise — Custom</option>
                </optgroup>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Unlimited is SA-only — assign from institute detail with a tier-change reason.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Students</label>
              <input
                type="number"
                value={form.maxStudents}
                onChange={(e) => setForm((f) => ({ ...f, maxStudents: parseInt(e.target.value) || 0 }))}
                min={1}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Users (staff)</label>
              <input
                type="number"
                value={form.maxUsers}
                onChange={(e) => setForm((f) => ({ ...f, maxUsers: parseInt(e.target.value) || 0 }))}
                min={1}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Storage (GB)</label>
              <input
                type="number"
                value={form.maxStorageGb}
                onChange={(e) => setForm((f) => ({ ...f, maxStorageGb: parseFloat(e.target.value) || 0 }))}
                min={0.1}
                step={0.1}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video (GB)</label>
              <input
                type="number"
                value={form.maxVideoGb}
                onChange={(e) => setForm((f) => ({ ...f, maxVideoGb: parseFloat(e.target.value) || 0 }))}
                min={0.1}
                step={0.1}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires At (optional)</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#2A2A2A] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Create Institute
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateAdmin} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-xl">
            Institute created successfully. Now create an admin user for this institute.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
              <input
                type="text"
                value={adminForm.name}
                onChange={(e) => setAdminForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="John Smith"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <input
                type="email"
                value={adminForm.email}
                onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                required
                placeholder="admin@acme.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={adminForm.password}
                onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={adminForm.phone}
                onChange={(e) => setAdminForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#2A2A2A] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Create Admin & Finish
          </button>
        </form>
      )}
    </div>
  );
}
