import type { Step } from 'react-joyride';

export const studentTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to your learning platform! Let us show you around so you can get started quickly.',
    title: 'Welcome!',
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: '#nav-courses',
    content: 'View your enrolled courses and watch video lectures here.',
    title: 'My Courses',
    placement: 'right',
  },
  {
    target: '#nav-classes',
    content: 'Join live Zoom classes with your teachers.',
    title: 'Zoom Classes',
    placement: 'right',
  },
  {
    target: '#nav-certificates',
    content: 'View and download your certificates after completing courses.',
    title: 'Certificates',
    placement: 'right',
  },
  {
    target: '#nav-jobs',
    content: 'Browse job opportunities posted by your institute.',
    title: 'Job Opportunities',
    placement: 'right',
  },
  {
    target: '#tour-help-btn',
    content: 'That\'s it! You can replay this tour anytime by clicking this help button.',
    title: 'Need Help?',
    placement: 'right',
  },
];
