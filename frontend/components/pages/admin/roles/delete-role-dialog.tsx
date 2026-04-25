'use client';

import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CustomRole } from '@/lib/types/rbac';

interface DeleteRoleDialogProps {
  role: CustomRole | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteRoleDialog({
  role,
  onConfirm,
  onCancel,
}: DeleteRoleDialogProps) {
  return (
    <AlertDialog open={!!role} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <AlertDialogTitle>
              Delete {role?.name ?? 'Role'}?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            This will reassign {role?.userCount ?? 0} user(s) to the Student
            role. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
