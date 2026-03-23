'use client';

import { useEffect, useState, ReactNode } from 'react';

interface ContentProtectionProps {
  children: ReactNode;
}

export function ContentProtection({ children }: ContentProtectionProps) {
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useEffect(() => {
    // Block keyboard shortcuts used for downloading/inspecting
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Basic DevTools detection via window size heuristic
    const checkDevTools = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      setDevToolsOpen(widthDiff || heightDiff);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', checkDevTools);
    checkDevTools();

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', checkDevTools);
    };
  }, []);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
    >
      {devToolsOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="text-red-400 text-5xl mb-4">&#9888;</div>
            <h2 className="text-white text-xl font-bold mb-2">Developer Tools Detected</h2>
            <p className="text-gray-300 text-sm">
              Please close developer tools to continue viewing content. This is a content protection measure.
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
