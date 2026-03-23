import type { Step } from 'react-joyride';

export const teacherTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to your Teacher dashboard! Here is a quick tour of everything you need.',
    title: 'Welcome!',
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: '#tour-stats',
    content: 'See your batches, students, and upcoming classes at a glance.',
    title: 'Quick Overview',
    placement: 'bottom',
  },
  {
    target: '#nav-batches',
    content: 'View your assigned batches and their students.',
    title: 'My Batches',
    placement: 'right',
  },
  {
    target: '#nav-classes',
    content: 'See scheduled Zoom classes and join them directly from here.',
    title: 'Zoom Classes',
    placement: 'right',
  },
  {
    target: '#tour-help-btn',
    content: 'That\'s it! You can replay this tour anytime by clicking this help button.',
    title: 'Need Help?',
    placement: 'right',
  },
];
