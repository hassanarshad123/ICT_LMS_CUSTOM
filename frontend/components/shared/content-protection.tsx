'use client';

import { useEffect, ReactNode } from 'react';

interface ContentProtectionProps {
  children: ReactNode;
}

export function ContentProtection({ children }: ContentProtectionProps) {
  useEffect(() => {
    // ── Keyboard shortcut blocking ──────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key?.toLowerCase() ?? '';

      if (
        // Save page
        (ctrl && key === 's') ||
        // View source
        (ctrl && key === 'u') ||
        // Print
        (ctrl && key === 'p') ||
        // Select all
        (ctrl && key === 'a') ||
        // Copy / Cut
        (ctrl && key === 'c') ||
        (ctrl && key === 'x') ||
        // DevTools panels
        (ctrl && shift && (key === 'i' || key === 'j' || key === 'c')) ||
        // DevTools (F12)
        key === 'f12' ||
        // Chrome clear data
        (ctrl && shift && key === 'delete')
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // ── Event blocking (selection, copy, cut, drag) ─────────────
    const blockEvent = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // ── Register listeners ──────────────────────────────────────
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('selectstart', blockEvent, true);
    document.addEventListener('copy', blockEvent, true);
    document.addEventListener('cut', blockEvent, true);
    document.addEventListener('dragstart', blockEvent, true);
    document.addEventListener('contextmenu', blockEvent, true);

    // ── Cleanup ─────────────────────────────────────────────────
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('selectstart', blockEvent, true);
      document.removeEventListener('copy', blockEvent, true);
      document.removeEventListener('cut', blockEvent, true);
      document.removeEventListener('dragstart', blockEvent, true);
      document.removeEventListener('contextmenu', blockEvent, true);
    };
  }, []);

  return (
    <div className="content-protected" style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}>
      {children}
    </div>
  );
}
