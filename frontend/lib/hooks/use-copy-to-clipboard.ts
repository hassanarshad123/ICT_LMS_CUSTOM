'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

export function useCopyToClipboard() {
  return useCallback(async (value: string, successMessage = 'Copied to clipboard') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Copy failed — clipboard blocked by the browser');
    }
  }, []);
}
