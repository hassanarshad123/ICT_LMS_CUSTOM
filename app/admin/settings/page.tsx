'use client';

import { useState } from 'react';
import SettingsView from '@/components/shared/settings-view';
import { Minus, Plus, Save, Monitor, Video, Edit3, Trash2, Star, Eye, EyeOff, X } from 'lucide-react';
import { zoomAccounts as initialAccounts } from '@/lib/mock-data';
import { ZoomAccount } from '@/lib/types';

export default function AdminSettings() {
  const [deviceLimit, setDeviceLimit] = useState(2);
  const [saved, setSaved] = useState(false);

  // Zoom accounts state
  const [accounts, setAccounts] = useState<ZoomAccount[]>(initialAccounts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [newAccount, setNewAccount] = useState({ accountName: '', accountId: '', clientId: '', clientSecret: '' });
  const [editForm, setEditForm] = useState({ accountName: '', accountId: '', clientId: '', clientSecret: '' });

  const decrease = () => {
    if (deviceLimit > 1) {
      setDeviceLimit(deviceLimit - 1);
      setSaved(false);
    }
  };

  const increase = () => {
    setDeviceLimit(deviceLimit + 1);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Zoom account handlers
  const toggleSecret = (id: string) => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskSecret = (secret: string) => {
    if (secret.length <= 6) return '••••••••';
    return secret.slice(0, 3) + '••••••••' + secret.slice(-3);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const isFirst = accounts.length === 0;
    const account: ZoomAccount = {
      id: `za${Date.now()}`,
      ...newAccount,
      isDefault: isFirst,
    };
    setAccounts([...accounts, account]);
    setNewAccount({ accountName: '', accountId: '', clientId: '', clientSecret: '' });
    setShowAddForm(false);
  };

  const handleDeleteAccount = (id: string) => {
    const updated = accounts.filter((a) => a.id !== id);
    if (accounts.find((a) => a.id === id)?.isDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }
    setAccounts(updated);
  };

  const handleSetDefault = (id: string) => {
    setAccounts(accounts.map((a) => ({ ...a, isDefault: a.id === id })));
  };

  const startEdit = (account: ZoomAccount) => {
    setEditingAccountId(account.id);
    setEditForm({
      accountName: account.accountName,
      accountId: account.accountId,
      clientId: account.clientId,
      clientSecret: account.clientSecret,
    });
  };

  const handleEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccounts(accounts.map((a) => (a.id === editingAccountId ? { ...a, ...editForm } : a)));
    setEditingAccountId(null);
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1A1A1A] bg-gray-50';

  return (
    <SettingsView
      role="admin"
      userName="Admin User"
      subtitle="Manage your account and system settings"
      extraCards={
        <>
          {/* Session Settings Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#C5D86D] rounded-xl flex items-center justify-center">
                <Monitor size={20} className="text-[#1A1A1A]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1A1A1A]">Session Settings</h3>
                <p className="text-xs text-gray-500">Control how many devices users can be logged in on simultaneously</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 sm:p-5 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Maximum Devices Per User
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={decrease}
                  disabled={deviceLimit <= 1}
                  className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus size={18} className="text-gray-600" />
                </button>
                <div className="w-16 h-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#1A1A1A]">{deviceLimit}</span>
                </div>
                <button
                  onClick={increase}
                  className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <Plus size={18} className="text-gray-600" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Users who exceed this limit will have their oldest session terminated automatically. Minimum: 1 device.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
            >
              <Save size={16} />
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>

          {/* Zoom Integration Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 card-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#C5D86D] rounded-xl flex items-center justify-center">
                  <Video size={20} className="text-[#1A1A1A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1A1A]">Zoom Integration</h3>
                  <p className="text-xs text-gray-500">Manage Zoom API accounts for auto-creating meeting links</p>
                </div>
              </div>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                >
                  <Plus size={16} />
                  Add Account
                </button>
              )}
            </div>

            {/* Add Form */}
            {showAddForm && (
              <form onSubmit={handleAddAccount} className="bg-gray-50 rounded-xl p-4 sm:p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-[#1A1A1A]">New Zoom Account</h4>
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
                    <input
                      type="text"
                      value={newAccount.accountName}
                      onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                      placeholder="e.g. ICT Main Account"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Account ID</label>
                    <input
                      type="text"
                      value={newAccount.accountId}
                      onChange={(e) => setNewAccount({ ...newAccount, accountId: e.target.value })}
                      placeholder="Zoom Account ID"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
                    <input
                      type="text"
                      value={newAccount.clientId}
                      onChange={(e) => setNewAccount({ ...newAccount, clientId: e.target.value })}
                      placeholder="OAuth Client ID"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
                    <div className="relative">
                      <input
                        type={showSecrets['new'] ? 'text' : 'password'}
                        value={newAccount.clientSecret}
                        onChange={(e) => setNewAccount({ ...newAccount, clientSecret: e.target.value })}
                        placeholder="OAuth Client Secret"
                        className={inputClass + ' pr-10'}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecret('new')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSecrets['new'] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                  >
                    <Plus size={16} />
                    Add Account
                  </button>
                </div>
              </form>
            )}

            {/* Account List */}
            {accounts.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-500">No Zoom accounts configured. Add one to enable auto-creating meeting links.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="bg-gray-50 rounded-xl p-4">
                    {editingAccountId === account.id ? (
                      /* Edit Form */
                      <form onSubmit={handleEditAccount}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
                            <input
                              type="text"
                              value={editForm.accountName}
                              onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })}
                              className={inputClass}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Account ID</label>
                            <input
                              type="text"
                              value={editForm.accountId}
                              onChange={(e) => setEditForm({ ...editForm, accountId: e.target.value })}
                              className={inputClass}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
                            <input
                              type="text"
                              value={editForm.clientId}
                              onChange={(e) => setEditForm({ ...editForm, clientId: e.target.value })}
                              className={inputClass}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
                            <div className="relative">
                              <input
                                type={showSecrets[account.id] ? 'text' : 'password'}
                                value={editForm.clientSecret}
                                onChange={(e) => setEditForm({ ...editForm, clientSecret: e.target.value })}
                                className={inputClass + ' pr-10'}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => toggleSecret(account.id)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showSecrets[account.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingAccountId(null)}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                          >
                            <Save size={14} />
                            Save
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Display Row */
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-[#1A1A1A]">{account.accountName}</h4>
                              {account.isDefault && (
                                <span className="px-2 py-0.5 bg-[#C5D86D] text-[#1A1A1A] text-[10px] font-bold rounded-full uppercase">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Secret: {showSecrets[account.id] ? account.clientSecret : maskSecret(account.clientSecret)}
                              <button
                                onClick={() => toggleSecret(account.id)}
                                className="ml-2 text-gray-400 hover:text-gray-600 inline-flex align-middle"
                              >
                                {showSecrets[account.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!account.isDefault && (
                            <button
                              onClick={() => handleSetDefault(account.id)}
                              title="Set as default"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#C5D86D] hover:bg-white transition-colors"
                            >
                              <Star size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(account)}
                            title="Edit"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#1A1A1A] hover:bg-white transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
                            title="Delete"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      }
    />
  );
}
