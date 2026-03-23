import type { Step } from 'react-joyride';

export const adminTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to your LMS dashboard! Let us show you around so you can manage your institute easily.',
    title: 'Welcome!',
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: '#sidebar-nav',
    content: 'This is your main menu. You can go to any section of the LMS from here.',
    title: 'Navigation Menu',
    placement: 'right',
  },
  {
    target: '#tour-stats',
    content: 'Here you can see how many students, batches, and teachers you have at a glance.',
    title: 'Quick Overview',
    placement: 'bottom',
  },
  {
    target: '#nav-batches',
    content: 'Click here to create and manage your batches (class groups). This is where you organize students.',
    title: 'Manage Batches',
    placement: 'right',
  },
  {
    target: '#nav-students',
    content: 'Click here to add new students, import students from CSV, or manage existing ones.',
    title: 'Manage Students',
    placement: 'right',
  },
  {
    target: '#nav-branding',
    content: 'Customize your institute\'s look — change colors, upload your logo, and set your institute name.',
    title: 'Branding',
    placement: 'right',
  },
  {
    target: '#nav-settings',
    content: 'Change your profile, password, and other account settings here.',
    title: 'Settings',
    placement: 'right',
  },
  {
    target: '#tour-help-btn',
    content: 'That\'s it! You can replay this tour anytime by clicking this help button.',
    title: 'Need Help?',
    placement: 'right',
  },
];
