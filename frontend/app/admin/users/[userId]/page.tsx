'use client';

import UserDetailView from '@/components/shared/user-detail-view';

export default function AdminUserDetailPage() {
  return <UserDetailView role="admin" userName="Admin User" backHref="/admin/users" />;
}
