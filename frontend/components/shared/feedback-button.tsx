'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import FeedbackFormModal from './feedback-form-modal';

interface ErrorContext {
  message?: string;
  stack?: string;
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);

  const handleOpenFeedback = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail) {
      setErrorContext(detail);
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener('open-feedback', handleOpenFeedback);
    return () => window.removeEventListener('open-feedback', handleOpenFeedback);
  }, [handleOpenFeedback]);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setErrorContext(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 hover:scale-105 transition-all"
        aria-label="Send feedback"
      >
        <MessageSquarePlus size={22} />
      </button>

      <FeedbackFormModal
        open={open}
        onOpenChange={handleOpenChange}
        errorContext={errorContext}
      />
    </>
  );
}
