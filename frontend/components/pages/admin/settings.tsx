'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import {
  User, Lock, Monitor, Award, KeyRound, Mail, Video, Shield,
  Save, Loader2, Plus, Minus, Eye, EyeOff, X, Edit3, Trash2, Star,
} from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import { getSettings, updateSettings } from '@/lib/api/admin';
import { updateUser } from '@/lib/api/users';
import { changePassword } from '@/lib/api/auth';
import { listAccounts, createAccount, updateAccount, deleteAccount, setDefaultAccount, ZoomAccountOut } from '@/lib/api/zoom';
import { toast } from 'sonner';
import { useBranding } from '@/lib/branding-context';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type TabType = 'account' | 'security' | 'notifications' | 'zoom';

const TABS: { key: TabType; label: string; icon: any }[] = [
  { key: 'account', label: 'Account', icon: User },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'notifications', label: 'Notifications', icon: Mail },
  { key: 'zoom', label: 'Zoom', icon: Video },
];

const EMAIL_GROUPS = [
  {
    title: 'Student Lifecycle',
    items: [
      { key: 'email_welcome', label: 'Welcome Email', desc: 'Sent when a new student account is created' },
      { key: 'email_enrollment', label: 'Enrollment Confirmation', desc: 'Sent when a student is added to a batch' },
      { key: 'email_certificate', label: 'Certificate Issued', desc: 'Sent when a certificate is approved' },
    ],
  },
  {
    title: 'Batch Access',
    items: [
      { key: 'email_batch_expiry_7d', label: 'Expiry Warning (7 days)', desc: 'Reminder 7 days before batch access ends' },
      { key: 'email_batch_expiry_1d', label: 'Expiry Warning (1 day)', desc: 'Urgent reminder 1 day before access ends' },
      { key: 'email_batch_expired', label: 'Batch Expired', desc: 'Notification when batch access has expired' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { key: 'email_announcement', label: 'Announcement Emails', desc: 'Sent when posted with the email toggle enabled' },
      { key: 'email_quiz_graded', label: 'Quiz Graded', desc: 'Sent when all quiz answers have been graded' },
      { key: 'email_zoom_reminder', label: 'Zoom Class Reminder', desc: 'Sent 15 minutes before a scheduled class' },
    ],
  },
];

// ── Toggle Switch ──────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/30 ${
        checked ? 'bg-green-500' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Number Stepper ─────────────────────────────────────────────

function NumberStepper({ value, onChange, min, max, step = 1, suffix }: {
  value: number; onChange: (v: number) => void; min: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30"
      >
        <Minus size={16} className="text-gray-600" />
      </button>
      <div className="w-16 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center">
        <span className="text-xl font-bold text-primary">{value}{suffix}</span>
      </div>
      <button
        onClick={() => onChange(max !== undefined ? Math.min(max, value + step) : value + step)}
        disabled={max !== undefined && value >= max}
        className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30"
      >
        <Plus size={16} className="text-gray-600" />
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export default function AdminSettings() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('account');

  // Data fetching
  const { data: settingsData, loading: settingsLoading } = useApi(getSettings);
  const { data: accountsData, loading: accountsLoading, refetch: refetchAccounts } = useApi(listAccounts);
  const { execute: saveSettings, loading: savingSettings } = useMutation(updateSettings);
  const { execute: doUpdateProfile, loading: savingProfile } = useMutation(updateUser);
  const { execute: doChangePassword, loading: savingPassword } = useMutation(changePassword);
  const { execute: doCreateAccount, loading: creatingAccount } = useMutation(createAccount);
  const { execute: doUpdateAccount } = useMutation(updateAccount);
  const { execute: doDeleteAccount } = useMutation(deleteAccount);
  const { execute: doSetDefault } = useMutation(setDefaultAccount);

  // Profile state
  const [profileData, setProfileData] = useState({ name: auth.name, email: auth.email, phone: auth.phone });

  // Password state
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');

  // Settings state
  const [deviceLimit, setDeviceLimit] = useState(2);
  const [deviceLimitMode, setDeviceLimitMode] = useState<'evict_oldest' | 'require_approval'>('evict_oldest');
  const [certThreshold, setCertThreshold] = useState(70);
  const [defaultStudentPassword, setDefaultStudentPassword] = useState('changeme123');
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);

  // Watermark state
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const { refetch: refetchBranding } = useBranding();

  // Email notification state (local copy for batch save)
  const [emailToggles, setEmailToggles] = useState<Record<string, boolean>>({});
  const [emailTogglesDirty, setEmailTogglesDirty] = useState(false);

  // Zoom state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [newAccount, setNewAccount] = useState({ accountName: '', accountId: '', clientId: '', clientSecret: '' });
  const [editForm, setEditForm] = useState({ accountName: '', accountId: '', clientId: '', clientSecret: '' });
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsData?.settings) return;
    const s = settingsData.settings;
    if (s.max_device_limit) setDeviceLimit(parseInt(s.max_device_limit, 10) || 2);
    if (s.device_limit_mode === 'require_approval' || s.device_limit_mode === 'evict_oldest') {
      setDeviceLimitMode(s.device_limit_mode);
    }
    if (s.certificate_completion_threshold) setCertThreshold(parseInt(s.certificate_completion_threshold, 10) || 70);
    if (s.default_student_password) setDefaultStudentPassword(s.default_student_password);
    setWatermarkEnabled((s.branding_watermark_enabled ?? 'true') !== 'false');

    // Initialize email toggles
    const toggles: Record<string, boolean> = {};
    for (const group of EMAIL_GROUPS) {
      for (const item of group.items) {
        toggles[item.key] = (s[item.key] ?? 'true') !== 'false';
      }
    }
    setEmailToggles(toggles);
  }, [settingsData]);

  const accounts: ZoomAccountOut[] = Array.isArray(accountsData) ? accountsData : [];
  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-shadow';

  // ── Handlers ───────────────────────────────────────────────

  const handleProfileSave = async () => {
    if (!auth.id) return;
    try {
      await doUpdateProfile(auth.id, { name: profileData.name, phone: profileData.phone });
      toast.success('Profile updated');
      const stored = localStorage.getItem('user');
      if (stored) { try { const u = JSON.parse(stored); u.name = profileData.name; u.phone = profileData.phone; localStorage.setItem('user', JSON.stringify(u)); } catch {} }
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePasswordUpdate = async () => {
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) { setPasswordError('Passwords do not match'); return; }
    if (!passwordData.currentPassword || !passwordData.newPassword) { setPasswordError('Please fill in all fields'); return; }
    try {
      await doChangePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success('Password updated');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSaveEmailToggles = async () => {
    try {
      const updates: Record<string, string> = {};
      for (const [key, val] of Object.entries(emailToggles)) { updates[key] = val ? 'true' : 'false'; }
      await saveSettings(updates);
      toast.success('Email notification settings saved');
      setEmailTogglesDirty(false);
    } catch { toast.error('Failed to save'); }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await doCreateAccount({ account_name: newAccount.accountName, account_id: newAccount.accountId, client_id: newAccount.clientId, client_secret: newAccount.clientSecret });
      toast.success('Zoom account added');
      setNewAccount({ accountName: '', accountId: '', clientId: '', clientSecret: '' });
      setShowAddForm(false);
      refetchAccounts();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccountId) return;
    try {
      await doUpdateAccount(editingAccountId, { account_name: editForm.accountName, account_id: editForm.accountId, client_id: editForm.clientId, ...(editForm.clientSecret ? { client_secret: editForm.clientSecret } : {}) });
      toast.success('Account updated');
      setEditingAccountId(null);
      refetchAccounts();
    } catch (err: any) { toast.error(err.message); }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Settings" subtitle="Manage your account and system settings" />

      <div className="w-full">
        {/* Tab Bar */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Account Tab ──────────────────────────────────── */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            {/* Profile */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Profile</h3>
              <p className="text-sm text-gray-500 mb-5">Your personal information</p>
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input type="text" value={profileData.name} onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input type="email" value={profileData.email} disabled className={inputClass + ' opacity-60 cursor-not-allowed'} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input type="text" value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} className={inputClass} />
                </div>
              </div>
              <button onClick={handleProfileSave} disabled={savingProfile} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Profile
              </button>
            </div>

            {/* Default Student Password */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Default Student Password</h3>
              <p className="text-sm text-gray-500 mb-5">All new students will be created with this password</p>
              {settingsLoading ? <div className="animate-pulse bg-gray-100 rounded-xl h-20" /> : (
                <>
                  <div className="relative mb-5 max-w-sm">
                    <input
                      type={showDefaultPassword ? 'text' : 'password'}
                      value={defaultStudentPassword}
                      onChange={(e) => setDefaultStudentPassword(e.target.value)}
                      placeholder="Enter default password"
                      className={inputClass + ' pr-10'}
                    />
                    <button type="button" onClick={() => setShowDefaultPassword(!showDefaultPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showDefaultPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button onClick={async () => { if (!defaultStudentPassword.trim()) { toast.error('Password cannot be empty'); return; } try { await saveSettings({ default_student_password: defaultStudentPassword.trim() }); toast.success('Default password saved'); } catch (e: any) { toast.error(e.message); } }} disabled={savingSettings} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                  </button>
                </>
              )}
            </div>

            {/* Certificate Threshold */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Certificate Threshold</h3>
              <p className="text-sm text-gray-500 mb-5">Minimum video completion percentage for certificate eligibility</p>
              {settingsLoading ? <div className="animate-pulse bg-gray-100 rounded-xl h-16" /> : (
                <div className="flex items-center gap-4">
                  <NumberStepper value={certThreshold} onChange={setCertThreshold} min={10} max={100} step={5} suffix="%" />
                  <button onClick={async () => { try { await saveSettings({ certificate_completion_threshold: String(certThreshold) }); toast.success('Threshold saved'); } catch (e: any) { toast.error(e.message); } }} disabled={savingSettings} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Security Tab ─────────────────────────────────── */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Change Password</h3>
              <p className="text-sm text-gray-500 mb-5">Update your account password</p>
              <div className="space-y-4 mb-5 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                  <input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} className={inputClass} placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} className={inputClass} placeholder="Enter new password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className={inputClass} placeholder="Confirm new password" />
                </div>
                {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
              </div>
              <button onClick={handlePasswordUpdate} disabled={savingPassword} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Update Password
              </button>
            </div>

            {/* Video Watermark */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Video Watermark</h3>
              <p className="text-sm text-gray-500 mb-5">Display a watermark with the student&apos;s email on lecture videos for anti-piracy protection</p>
              {settingsLoading ? <div className="animate-pulse bg-gray-100 rounded-xl h-16" /> : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Shield size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Enable watermark overlay</p>
                      <p className="text-xs text-gray-500">{watermarkEnabled ? 'Student email shown on all videos' : 'Watermark is disabled'}</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const newVal = !watermarkEnabled;
                      setWatermarkEnabled(newVal);
                      try {
                        await saveSettings({ branding_watermark_enabled: newVal ? 'true' : 'false' });
                        await refetchBranding();
                        toast.success(newVal ? 'Watermark enabled' : 'Watermark disabled');
                      } catch (e: any) {
                        setWatermarkEnabled(!newVal);
                        toast.error(e.message || 'Failed to update');
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${watermarkEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${watermarkEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Session Settings */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Session Settings</h3>
              <p className="text-sm text-gray-500 mb-5">Control how many devices users can be logged in on simultaneously</p>
              {settingsLoading ? <div className="animate-pulse bg-gray-100 rounded-xl h-32" /> : (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <NumberStepper value={deviceLimit} onChange={setDeviceLimit} min={1} />
                    <span className="text-sm text-gray-500">devices per user</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      When a user exceeds the limit
                    </label>
                    <select
                      value={deviceLimitMode}
                      onChange={(e) => setDeviceLimitMode(e.target.value as 'evict_oldest' | 'require_approval')}
                      className={inputClass}
                    >
                      <option value="evict_oldest">Evict oldest device automatically (default)</option>
                      <option value="require_approval">Require admin approval for new devices</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {deviceLimitMode === 'evict_oldest'
                        ? 'New logins succeed silently; the oldest existing session is terminated to make room.'
                        : 'New logins are blocked until an admin (or course creator for students/teachers) approves the request from the Devices page. Admins and super-admins remain on "evict oldest" to prevent lockout.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={async () => {
                        try {
                          await saveSettings({
                            max_device_limit: String(deviceLimit),
                            device_limit_mode: deviceLimitMode,
                          });
                          toast.success('Session settings saved');
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      disabled={savingSettings}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Notifications Tab ────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Email Notifications</h3>
              <p className="text-sm text-gray-500 mb-6">Control which emails are sent to students. Students can also manage their own preferences.</p>

              {settingsLoading ? <div className="animate-pulse bg-gray-100 rounded-xl h-40" /> : (
                <div className="space-y-8">
                  {EMAIL_GROUPS.map((group) => (
                    <div key={group.title}>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{group.title}</h4>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <div key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                            <div className="mr-4">
                              <div className="text-sm font-medium text-gray-900">{item.label}</div>
                              <div className="text-xs text-gray-500">{item.desc}</div>
                            </div>
                            <ToggleSwitch
                              checked={emailToggles[item.key] ?? true}
                              onChange={() => {
                                setEmailToggles({ ...emailToggles, [item.key]: !emailToggles[item.key] });
                                setEmailTogglesDirty(true);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleSaveEmailToggles}
                    disabled={!emailTogglesDirty || savingSettings}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Zoom Tab ─────────────────────────────────────── */}
        {activeTab === 'zoom' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Zoom Integration</h3>
                  <p className="text-sm text-gray-500">Manage Zoom API accounts for auto-creating meeting links</p>
                </div>
                {!showAddForm && (
                  <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                    <Plus size={16} /> Add Account
                  </button>
                )}
              </div>

              {/* Add Form */}
              {showAddForm && (
                <form onSubmit={handleAddAccount} className="bg-gray-50 rounded-xl p-5 mb-5 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">New Zoom Account</h4>
                    <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label><input type="text" value={newAccount.accountName} onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })} className={inputClass} required /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Account ID</label><input type="text" value={newAccount.accountId} onChange={(e) => setNewAccount({ ...newAccount, accountId: e.target.value })} className={inputClass} required /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label><input type="text" value={newAccount.clientId} onChange={(e) => setNewAccount({ ...newAccount, clientId: e.target.value })} className={inputClass} required /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
                      <div className="relative"><input type={showSecrets['new'] ? 'text' : 'password'} value={newAccount.clientSecret} onChange={(e) => setNewAccount({ ...newAccount, clientSecret: e.target.value })} className={inputClass + ' pr-10'} required /><button type="button" onClick={() => setShowSecrets({ ...showSecrets, new: !showSecrets['new'] })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showSecrets['new'] ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button type="submit" disabled={creatingAccount} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                      {creatingAccount ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add Account
                    </button>
                  </div>
                </form>
              )}

              {/* Account List */}
              {accountsLoading ? (
                <div className="animate-pulse bg-gray-100 rounded-xl h-24" />
              ) : accounts.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
                  <Video size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No Zoom accounts configured</p>
                  <p className="text-xs text-gray-400 mt-1">Add one to enable auto-creating meeting links</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div key={account.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      {editingAccountId === account.id ? (
                        <form onSubmit={handleEditAccount}>
                          <div className="grid sm:grid-cols-2 gap-3 mb-3">
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label><input type="text" value={editForm.accountName} onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })} className={inputClass} required /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Account ID</label><input type="text" value={editForm.accountId} onChange={(e) => setEditForm({ ...editForm, accountId: e.target.value })} className={inputClass} required /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label><input type="text" value={editForm.clientId} onChange={(e) => setEditForm({ ...editForm, clientId: e.target.value })} className={inputClass} required /></div>
                            <div><label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
                              <div className="relative"><input type={showSecrets[account.id] ? 'text' : 'password'} value={editForm.clientSecret} onChange={(e) => setEditForm({ ...editForm, clientSecret: e.target.value })} placeholder="Leave empty to keep current" className={inputClass + ' pr-10'} /><button type="button" onClick={() => setShowSecrets({ ...showSecrets, [account.id]: !showSecrets[account.id] })} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showSecrets[account.id] ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingAccountId(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                            <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"><Save size={14} /> Save</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-gray-900">{account.accountName}</h4>
                              {account.isDefault && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">Default</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">ID: {account.accountId || '—'}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {!account.isDefault && <button onClick={() => { doSetDefault(account.id).then(() => { toast.success('Default updated'); refetchAccounts(); }).catch((e: any) => toast.error(e.message)); }} title="Set as default" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-yellow-500 hover:bg-white transition-colors"><Star size={16} /></button>}
                            <button onClick={() => { setEditingAccountId(account.id); setEditForm({ accountName: account.accountName, accountId: account.accountId || '', clientId: account.clientId || '', clientSecret: '' }); }} title="Edit" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-white transition-colors"><Edit3 size={16} /></button>
                            <button onClick={() => setDeleteAccountId(account.id)} title="Delete" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white transition-colors"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteAccountId} onOpenChange={(open) => !open && setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zoom Account</AlertDialogTitle>
            <AlertDialogDescription>This will also cascade to all zoom classes using this account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAccountId && doDeleteAccount(deleteAccountId).then(() => { toast.success('Account deleted'); setDeleteAccountId(null); refetchAccounts(); }).catch((e: any) => { toast.error(e.message); setDeleteAccountId(null); })} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
