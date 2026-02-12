'use client';
import UsersListView from '@/components/shared/users-list-view';
export default function AdminUsersPage() {
  return <UsersListView role="admin" userName="Admin User" basePath="/admin/users" />;
}
