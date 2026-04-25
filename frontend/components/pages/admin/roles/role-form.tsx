'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  getRole,
  getPermissionGroups,
  createRole,
  updateRole,
  setRolePermissions,
} from '@/lib/api/rbac';
import type { ViewType } from '@/lib/types/rbac';
import PermissionMatrix from './permission-matrix';

interface RoleFormProps {
  roleId?: string;
  onSave: () => void;
  onCancel: () => void;
}

const VIEW_TYPE_OPTIONS: { value: ViewType; label: string }[] = [
  { value: 'student_view', label: 'Student View' },
  { value: 'staff_view', label: 'Staff View' },
  { value: 'admin_view', label: 'Admin View' },
];

export default function RoleForm({ roleId, onSave, onCancel }: RoleFormProps) {
  const isEditing = !!roleId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [viewType, setViewType] = useState<ViewType>('student_view');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );

  const { data: permissionGroups, loading: groupsLoading } = useApi(
    getPermissionGroups,
  );

  const { data: roleData, loading: roleLoading } = useApi(
    () => (roleId ? getRole(roleId) : Promise.resolve(null)),
    [roleId],
  );

  const { execute: doCreate, loading: creating } = useMutation(createRole);
  const { execute: doUpdate, loading: updating } = useMutation(updateRole);
  const { execute: doSetPermissions, loading: settingPerms } = useMutation(
    setRolePermissions,
  );

  // Populate form when editing
  useEffect(() => {
    if (!roleData) return;
    setName(roleData.name);
    setDescription(roleData.description ?? '');
    setViewType(roleData.viewType);
    setSelectedPermissions(new Set(roleData.permissions));
  }, [roleData]);

  const isSaving = creating || updating || settingPerms;
  const isLoading = groupsLoading || (isEditing && roleLoading);

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-shadow';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Role name is required');
      return;
    }

    try {
      if (isEditing && roleId) {
        await doUpdate(roleId, {
          name: trimmedName,
          description: description.trim() || undefined,
          viewType,
        });
        await doSetPermissions(roleId, Array.from(selectedPermissions));
        toast.success('Role updated');
      } else {
        await doCreate({
          name: trimmedName,
          description: description.trim() || undefined,
          viewType,
          permissions: Array.from(selectedPermissions),
        });
        toast.success('Role created');
      }
      onSave();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save role');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEditing ? 'Edit Role' : 'Create Role'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Role Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Teaching Assistant"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this role..."
            rows={3}
            className={inputClass + ' resize-none'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            View Type
          </label>
          <select
            value={viewType}
            onChange={(e) => setViewType(e.target.value as ViewType)}
            className={inputClass}
          >
            {VIEW_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Determines which dashboard layout users with this role will see.
          </p>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          Permissions
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          Select which permissions this role grants.
        </p>
        <PermissionMatrix
          groups={permissionGroups ?? []}
          selected={selectedPermissions}
          onChange={setSelectedPermissions}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isEditing ? 'Save Changes' : 'Create Role'}
        </button>
      </div>
    </form>
  );
}
