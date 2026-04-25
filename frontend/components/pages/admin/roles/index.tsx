'use client';

import { useState } from 'react';
import { Plus, Edit3, Trash2, Shield, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApi, useMutation } from '@/hooks/use-api';
import { listRoles, getSystemRolePermissions, deleteRole } from '@/lib/api/rbac';
import { usePermission } from '@/hooks/use-permission';
import { P } from '@/lib/permissions';
import type { CustomRole, SystemRolePermissions } from '@/lib/types/rbac';
import RoleForm from './role-form';
import DeleteRoleDialog from './delete-role-dialog';

const VIEW_TYPE_LABELS: Record<string, string> = {
  student_view: 'Student View',
  staff_view: 'Staff View',
  admin_view: 'Admin View',
};

const VIEW_TYPE_COLORS: Record<string, string> = {
  student_view: 'bg-blue-100 text-blue-700',
  staff_view: 'bg-amber-100 text-amber-700',
  admin_view: 'bg-purple-100 text-purple-700',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function RolesManager() {
  const canCreate = usePermission(P.ROLES_CREATE);
  const canEdit = usePermission(P.ROLES_EDIT);
  const canDelete = usePermission(P.ROLES_DELETE);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);

  const {
    data: customRoles,
    loading: rolesLoading,
    refetch: refetchRoles,
  } = useApi(listRoles);

  const { data: systemRoles, loading: systemLoading } = useApi(
    getSystemRolePermissions,
  );

  const { execute: doDelete } = useMutation(deleteRole);

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await doDelete(deletingRole.id);
      toast.success(`Role "${deletingRole.name}" deleted`);
      setDeletingRole(null);
      refetchRoles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete role');
      setDeletingRole(null);
    }
  };

  const handleSave = () => {
    setMode('list');
    setEditingRoleId(null);
    refetchRoles();
  };

  const handleCancel = () => {
    setMode('list');
    setEditingRoleId(null);
  };

  const isLoading = rolesLoading || systemLoading;
  const roles: CustomRole[] = customRoles ?? [];
  const sysRoles: SystemRolePermissions[] = systemRoles ?? [];

  // ── Form View ──────────────────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    return (
      <RoleForm
        roleId={mode === 'edit' ? editingRoleId ?? undefined : undefined}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  // ── List View ──────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Roles &amp; Permissions
          </h3>
          <p className="text-sm text-gray-500">
            Manage custom roles and their permissions
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setMode('create')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Create Role
          </button>
        )}
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    View Type
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Users
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Created
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* System Roles */}
                {sysRoles.map((sr) => (
                  <tr
                    key={`sys-${sr.role}`}
                    className="border-b border-gray-50 bg-gray-50/30"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-700 capitalize">
                          {sr.role.replace(/_/g, ' ')}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-200 text-gray-600">
                          System
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400">--</td>
                    <td className="px-5 py-3 text-gray-400">--</td>
                    <td className="px-5 py-3 text-gray-400">--</td>
                    <td className="px-5 py-3 text-right text-gray-300 text-xs italic">
                      Read-only
                    </td>
                  </tr>
                ))}

                {/* Custom Roles */}
                {roles.length === 0 && sysRoles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <Users
                        size={32}
                        className="text-gray-300 mx-auto mb-3"
                      />
                      <p className="text-sm text-gray-500">
                        No custom roles yet
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Create one to assign granular permissions to users
                      </p>
                    </td>
                  </tr>
                )}

                {roles.map((role) => (
                  <tr
                    key={role.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div>
                        <span className="font-medium text-gray-900">
                          {role.name}
                        </span>
                        {role.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                            {role.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          VIEW_TYPE_COLORS[role.viewType] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {VIEW_TYPE_LABELS[role.viewType] ?? role.viewType}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gray-700">{role.userCount}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {formatDate(role.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditingRoleId(role.id);
                              setMode('edit');
                            }}
                            title="Edit"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeletingRole(role)}
                            title="Delete"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <DeleteRoleDialog
        role={deletingRole}
        onConfirm={handleDelete}
        onCancel={() => setDeletingRole(null)}
      />
    </div>
  );
}
