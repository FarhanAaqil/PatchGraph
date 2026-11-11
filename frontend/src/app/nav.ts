import {
  ClipboardCheck,
  Home,
  ListChecks,
  Network,
  Settings2,
  ShieldAlert,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'workflow' | 'explore' | 'system' | 'home';
  /** Position in the four-step journey, if it is part of it. */
  step?: 1 | 2 | 3 | 4;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', description: 'Where things stand and what to do next', icon: Home, group: 'home' },
  {
    path: '/import',
    label: 'Import',
    description: 'Bring in your software inventory',
    icon: UploadCloud,
    group: 'workflow',
    step: 1,
  },
  {
    path: '/risks',
    label: 'Risks',
    description: 'See which vulnerabilities matter most',
    icon: ShieldAlert,
    group: 'workflow',
    step: 2,
  },
  {
    path: '/plan',
    label: 'Plan',
    description: 'Choose the fixes that fit your budget',
    icon: ListChecks,
    group: 'workflow',
    step: 3,
  },
  {
    path: '/review',
    label: 'Review',
    description: 'Approve a plan and keep the record',
    icon: ClipboardCheck,
    group: 'workflow',
    step: 4,
  },
  {
    path: '/map',
    label: 'Map',
    description: 'Explore how software and services connect',
    icon: Network,
    group: 'explore',
  },
  {
    path: '/settings',
    label: 'Settings',
    description: 'Data sources, appearance and shortcuts',
    icon: Settings2,
    group: 'system',
  },
];

export function findNavItem(pathname: string): NavItem {
  const exact = NAV_ITEMS.find((item) => item.path === pathname);
  if (exact) return exact;
  const nested = NAV_ITEMS.filter((item) => item.path !== '/').find((item) => pathname.startsWith(`${item.path}/`));
  return nested ?? NAV_ITEMS[0];
}
