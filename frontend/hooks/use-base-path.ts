'use client';

import { useParams } from 'next/navigation';

export function useBasePath() {
  const { userId } = useParams<{ userId: string }>();
  return `/${userId}`;
}
