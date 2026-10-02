import type { LucideIcon } from 'lucide-react';
import { Layers, Bell, CreditCard, PiggyBank, Calendar, Repeat, Users } from 'lucide-react';

export type NavGroupId = 'month' | 'recurring' | 'manage';

export type NavGroupLabelKey = 'groupMonth' | 'groupRecurring' | 'groupManage';

export interface NavItem {
  href: string;
  labelKey:
    | 'overview'
    | 'alerts'
    | 'expenses'
    | 'savings'
    | 'calendar'
    | 'recurring'
    | 'walletTeam';
  icon: LucideIcon;
  monthScoped: boolean;
  mobileBar: boolean;
}

export interface NavGroup {
  id: NavGroupId;
  labelKey: NavGroupLabelKey;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'month',
    labelKey: 'groupMonth',
    items: [
      { href: '/', labelKey: 'overview', icon: Layers, monthScoped: true, mobileBar: true },
      { href: '/alerts', labelKey: 'alerts', icon: Bell, monthScoped: true, mobileBar: false },
      { href: '/expenses', labelKey: 'expenses', icon: CreditCard, monthScoped: true, mobileBar: true },
      { href: '/savings', labelKey: 'savings', icon: PiggyBank, monthScoped: true, mobileBar: true },
      { href: '/calendar', labelKey: 'calendar', icon: Calendar, monthScoped: true, mobileBar: true },
    ],
  },
  {
    id: 'recurring',
    labelKey: 'groupRecurring',
    items: [
      { href: '/recurring', labelKey: 'recurring', icon: Repeat, monthScoped: false, mobileBar: true },
    ],
  },
  {
    id: 'manage',
    labelKey: 'groupManage',
    items: [
      { href: '/wallet', labelKey: 'walletTeam', icon: Users, monthScoped: false, mobileBar: false },
    ],
  },
];

const MONTH_SCOPED_HREFS = new Set<string>(
  NAV_GROUPS.flatMap((g) => g.items)
    .filter((i) => i.monthScoped)
    .map((i) => i.href)
);

export function isMonthScopedPath(pathname: string): boolean {
  if (!pathname) return false;
  return MONTH_SCOPED_HREFS.has(pathname);
}
