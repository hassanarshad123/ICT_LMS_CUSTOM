import type { Step } from 'react-joyride';

export const ccTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to your Course Creator dashboard! Let us walk you through the key features.',
    title: 'Welcome!',
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: '#sidebar-nav',
    content: 'This is your main menu. Navigate to any section of the LMS from here.',
    title: 'Navigation Menu',
    placement: 'right',
  },
  {
    target: '#nav-courses',
    content: 'Create courses, add curriculum, and manage all your content here.',
    title: 'Manage Courses',
    placement: 'right',
  },
  {
    target: '#nav-batches',
    content: 'Manage student groups and assign courses to batches.',
    title: 'Manage Batches',
    placement: 'right',
  },
  {
    target: '#nav-upload',
    content: 'Upload lecture videos for your courses. Supports large files with resumable uploads.',
    title: 'Upload Videos',
    placement: 'right',
  },
  {
    target: '#nav-schedule',
    content: 'Schedule live Zoom classes for your batches.',
    title: 'Schedule Classes',
    placement: 'right',
  },
  {
    target: '#tour-help-btn',
    content: 'That\'s it! You can replay this tour anytime by clicking this help button.',
    title: 'Need Help?',
    placement: 'right',
  },
];
