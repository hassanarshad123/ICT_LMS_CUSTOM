'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import UploadVideos from '@/components/pages/cc/upload-videos';

export default function UploadPage() {
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== 'course-creator' && role !== 'admin') {
      router.push('/');
    }
  }, [role, router]);

  if (!role || (role !== 'course-creator' && role !== 'admin')) return null;

  return <UploadVideos />;
}
