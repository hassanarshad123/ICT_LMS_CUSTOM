'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { EventData, Controls } from 'react-joyride';
import { useAuth } from '@/lib/auth-context';
import { adminTourSteps } from '@/lib/tours/admin-tour';
import { ccTourSteps } from '@/lib/tours/cc-tour';
import { teacherTourSteps } from '@/lib/tours/teacher-tour';
import { studentTourSteps } from '@/lib/tours/student-tour';

// Dynamic import to avoid SSR issues — Joyride is a named export in v3
const JoyrideComponent = dynamic(
  () => import('react-joyride').then((mod) => ({ default: mod.Joyride })),
  { ssr: false },
);

interface TourContextType {
  startTour: () => void;
}

const TourContext = createContext<TourContextType>({ startTour: () => {} });

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Get steps based on role (role uses kebab-case from auth context)
  const steps = role === 'admin' ? adminTourSteps
    : role === 'course-creator' ? ccTourSteps
    : role === 'teacher' ? teacherTourSteps
    : role === 'student' ? studentTourSteps
    : [];

  // Check if tour should auto-start
  useEffect(() => {
    setMounted(true);
    if (!role || typeof window === 'undefined') return;
    const key = `tour_completed_${role}`;
    const completed = localStorage.getItem(key);
    if (!completed && steps.length > 0) {
      // Delay to let dashboard elements render
      const timer = setTimeout(() => setRun(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [role, steps.length]);

  const startTour = useCallback(() => {
    setRun(true);
  }, []);

  const handleEvent = useCallback((data: EventData, controls: Controls) => {
    const { status } = data;
    const finishedStatuses: string[] = ['finished', 'skipped'];
    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (role) {
        localStorage.setItem(`tour_completed_${role}`, 'true');
      }
    }
  }, [role]);

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {mounted && steps.length > 0 && (
        <JoyrideComponent
          steps={steps}
          run={run}
          continuous
          onEvent={handleEvent}
          options={{
            primaryColor: '#1A1A1A',
            zIndex: 10000,
            arrowColor: '#fff',
            backgroundColor: '#fff',
            textColor: '#333',
            showProgress: true,
            skipBeacon: true,
            buttons: ['back', 'close', 'primary', 'skip'],
          }}
          styles={{
            tooltip: {
              borderRadius: 16,
              padding: 20,
            },
            buttonPrimary: {
              borderRadius: 12,
              padding: '8px 20px',
              fontSize: 14,
            },
            buttonBack: {
              borderRadius: 12,
              padding: '8px 16px',
              fontSize: 14,
              color: '#666',
            },
            buttonSkip: {
              color: '#999',
              fontSize: 13,
            },
          }}
          locale={{
            back: 'Back',
            close: 'Close',
            last: 'Got it!',
            next: 'Next',
            skip: 'Skip tour',
          }}
        />
      )}
    </TourContext.Provider>
  );
}
