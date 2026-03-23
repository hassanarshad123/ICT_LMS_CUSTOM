'use client';

import { useEffect, useState, useRef, useCallback, ReactNode } from 'react';

interface ContentProtectionProps {
  children: ReactNode;
}

export function ContentProtection({ children }: ContentProtectionProps) {
  const [threatDetected, setThreatDetected] = useState(false);
  const devToolsRef = useRef(false);

  const flagThreat = useCallback(() => {
    if (!devToolsRef.current) {
      devToolsRef.current = true;
      setThreatDetected(true);
    }
  }, []);

  const clearThreat = useCallback(() => {
    if (devToolsRef.current) {
      devToolsRef.current = false;
      setThreatDetected(false);
    }
  }, []);

  useEffect(() => {
    // ── Phase 1: Keyboard shortcut blocking ──────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

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

    // ── Phase 1: Event blocking (selection, copy, cut, drag) ─────
    const blockEvent = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // ── Phase 2: DevTools detection — window size heuristic ──────
    const checkWindowSize = (): boolean => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      return widthDiff || heightDiff;
    };

    // ── Phase 2: DevTools detection — debugger timing trap ───────
    const checkDebuggerTrap = (): boolean => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      return performance.now() - start > 100;
    };

    // ── Phase 2: Combined DevTools poll (every 1s) ───────────────
    const pollDevTools = () => {
      const sizeDetected = checkWindowSize();
      const debugDetected = checkDebuggerTrap();

      if (sizeDetected || debugDetected) {
        flagThreat();
      } else if (devToolsRef.current) {
        // Only clear if previously flagged by DevTools (not extension)
        clearThreat();
      }
    };

    // ── Phase 2: Console clearing (every 2s) ─────────────────────
    const consoleClearInterval = setInterval(() => {
      try { console.clear(); } catch { /* ignore */ }
    }, 2000);

    // ── Phase 3: Extension detection — known globals ─────────────
    const checkExtensionGlobals = () => {
      const w = window as any;
      if (
        w.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
        w.__VUE_DEVTOOLS_GLOBAL_HOOK__
      ) {
        flagThreat();
      }
    };

    // ── Phase 3: Extension detection — MutationObserver ──────────
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Detect injected script tags
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node instanceof HTMLScriptElement) {
            const src = node.src || '';
            // Allow our own scripts (Next.js chunks)
            if (!src.startsWith(window.location.origin) && !src.startsWith('/') && src !== '') {
              flagThreat();
              return;
            }
          }
          // Detect extension-injected iframes
          if (node instanceof HTMLIFrameElement) {
            const src = node.src || '';
            if (src.startsWith('chrome-extension://') || src.startsWith('moz-extension://')) {
              flagThreat();
              return;
            }
          }
        }
        // Detect attribute tampering on body/html (extensions often add classes/data attrs)
        if (mutation.type === 'attributes' && mutation.target === document.body) {
          const attr = mutation.attributeName || '';
          if (attr.startsWith('data-') && !['data-theme', 'data-sonner-toaster'].includes(attr)) {
            // Unknown data attribute injected on body — possible extension
            flagThreat();
            return;
          }
        }
      }
    });

    // ── Register all listeners ───────────────────────────────────
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('selectstart', blockEvent, true);
    document.addEventListener('copy', blockEvent, true);
    document.addEventListener('cut', blockEvent, true);
    document.addEventListener('dragstart', blockEvent, true);
    document.addEventListener('contextmenu', blockEvent, true);

    // Start DevTools polling
    const devToolsInterval = setInterval(pollDevTools, 1000);
    pollDevTools(); // Initial check

    // Check extension globals
    checkExtensionGlobals();

    // Start mutation observer
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-*', 'class', 'style'],
    });

    // ── Cleanup ──────────────────────────────────────────────────
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('selectstart', blockEvent, true);
      document.removeEventListener('copy', blockEvent, true);
      document.removeEventListener('cut', blockEvent, true);
      document.removeEventListener('dragstart', blockEvent, true);
      document.removeEventListener('contextmenu', blockEvent, true);
      clearInterval(devToolsInterval);
      clearInterval(consoleClearInterval);
      observer.disconnect();
    };
  }, [flagThreat, clearThreat]);

  return (
    <div className="content-protected" style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}>
      {threatDetected && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="text-red-500 text-6xl mb-4">&#9888;</div>
            <h2 className="text-white text-2xl font-bold mb-3">
              Content Protection Alert
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              Developer tools or unauthorized browser extensions have been detected.
              Please close all developer tools and disable content-scraping extensions
              to continue using the platform.
            </p>
            <p className="text-gray-500 text-xs mt-4">
              This content is protected by copyright. Unauthorized copying or distribution is prohibited.
            </p>
          </div>
        </div>
      )}
      <div style={threatDetected ? { filter: 'blur(20px)', pointerEvents: 'none' } : undefined}>
        {children}
      </div>
    </div>
  );
}
