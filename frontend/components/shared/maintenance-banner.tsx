'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function MaintenanceBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('maintenance-mode', handler);
    return () => window.removeEventListener('maintenance-mode', handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <AlertTriangle size={16} />
      Platform is in maintenance mode. Write operations are temporarily disabled.
      <button
        onClick={() => setVisible(false)}
        className="ml-4 text-xs underline hover:no-underline"
      >
        Dismiss
      </button>
    </div>
  );
}
