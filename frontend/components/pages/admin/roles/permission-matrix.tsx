'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { PermissionGroup } from '@/lib/types/rbac';

interface PermissionMatrixProps {
  groups: PermissionGroup[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  readOnly?: boolean;
}

export default function PermissionMatrix({
  groups,
  selected,
  onChange,
  readOnly = false,
}: PermissionMatrixProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.module)),
  );

  const toggleModule = (module: string) => {
    const next = new Set(expandedModules);
    if (next.has(module)) {
      next.delete(module);
    } else {
      next.add(module);
    }
    setExpandedModules(next);
  };

  const isAllSelected = (group: PermissionGroup): boolean =>
    group.permissions.length > 0 &&
    group.permissions.every((p) => selected.has(p.code));

  const isSomeSelected = (group: PermissionGroup): boolean =>
    group.permissions.some((p) => selected.has(p.code)) && !isAllSelected(group);

  const toggleAll = (group: PermissionGroup) => {
    if (readOnly) return;
    const next = new Set(selected);
    const allChecked = isAllSelected(group);
    for (const perm of group.permissions) {
      if (allChecked) {
        next.delete(perm.code);
      } else {
        next.add(perm.code);
      }
    }
    onChange(next);
  };

  const togglePermission = (code: string) => {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    onChange(next);
  };

  if (groups.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
        <p className="text-sm text-gray-500">No permission groups available</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const expanded = expandedModules.has(group.module);
        const allSelected = isAllSelected(group);
        const someSelected = isSomeSelected(group);

        return (
          <div
            key={group.module}
            className="border border-gray-100 rounded-xl overflow-hidden"
          >
            {/* Module Header */}
            <button
              type="button"
              onClick={() => toggleModule(group.module)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              {expanded ? (
                <ChevronDown size={16} className="text-gray-400 shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              )}

              <div
                className="shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAll(group);
                }}
              >
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  disabled={readOnly}
                  onCheckedChange={() => toggleAll(group)}
                />
              </div>

              <span className="text-sm font-medium text-gray-900">
                {group.label}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {group.permissions.filter((p) => selected.has(p.code)).length}/
                {group.permissions.length}
              </span>
            </button>

            {/* Permission Items */}
            {expanded && (
              <div className="px-4 py-2 space-y-1">
                {group.permissions.map((perm) => (
                  <label
                    key={perm.code}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      readOnly
                        ? 'cursor-not-allowed opacity-70'
                        : 'cursor-pointer hover:bg-gray-50'
                    }`}
                  >
                    <Checkbox
                      checked={selected.has(perm.code)}
                      disabled={readOnly}
                      onCheckedChange={() => togglePermission(perm.code)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-800">
                        {perm.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      {perm.description && (
                        <p className="text-xs text-gray-400 truncate">
                          {perm.description}
                        </p>
                      )}
                    </div>
                    <code className="text-[10px] text-gray-300 font-mono hidden sm:block">
                      {perm.code}
                    </code>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
