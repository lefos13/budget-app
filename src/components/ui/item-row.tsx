import React from 'react';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface ItemRowProps {
  /** Icon tile on the left; omit for rows without one. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Native tooltip with the full title (the title clamps to two lines). */
  titleText?: string;
  /** Chips (type, recurrence, due-in) shown before `meta` on the details line. */
  badges?: React.ReactNode;
  /** Plain secondary info: date, invoice number, category... */
  meta?: React.ReactNode;
  amount: React.ReactNode;
  /** Status pill: footer line on mobile, under the amount from sm. */
  status?: React.ReactNode;
  /** Primary action + icon buttons. */
  actions?: React.ReactNode;
  /** Container visuals (padding, border, background) differ per list. */
  className?: string;
  as?: 'div' | 'li';
}

/*
 * The one row for "money item" lists (bills, subscriptions, expenses, savings
 * movements). Placement lives in the `.item-row*` grid in globals.css: the
 * amount never shrinks, the title wraps to two lines instead of collapsing, and
 * when the row itself is narrow, status + actions drop to their own footer line.
 */
export function ItemRow({
  leading,
  title,
  titleText,
  badges,
  meta,
  amount,
  status,
  actions,
  className,
  as: Tag = 'div',
}: ItemRowProps) {
  const hasFooter = Boolean(status || actions);
  return (
    <Tag className={clsx('item-row-box', className)}>
      <div className={clsx('item-row', !leading && 'item-row--no-lead')}>
        {leading && <div className="item-row__lead">{leading}</div>}
        <p
          className="item-row__title text-sm font-bold leading-snug text-zinc-900 dark:text-white line-clamp-2"
          title={titleText}
        >
          {title}
        </p>
        <div className="item-row__amount text-sm font-black leading-snug text-zinc-900 dark:text-white tabular-nums whitespace-nowrap">
          {amount}
        </div>
        {(badges || meta) && (
          <div className="item-row__details mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-zinc-500 dark:text-zinc-400">
            {badges}
            {meta}
          </div>
        )}
        {hasFooter && (
          <div className="item-row__footer flex flex-wrap items-center justify-between gap-2">
            {status && <div className="item-row__status">{status}</div>}
            {actions && <div className="item-row__actions flex items-center gap-1">{actions}</div>}
          </div>
        )}
      </div>
    </Tag>
  );
}

type Tone = 'emerald' | 'indigo';

const PRIMARY_TONES: Record<Tone, string> = {
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
};

interface RowPrimaryActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  tone?: Tone;
}

/** Filled row button (e.g. "Mark paid"); 44px tall on touch screens, compact from sm. */
export function RowPrimaryAction({
  icon: Icon,
  tone = 'emerald',
  className,
  children,
  type = 'button',
  ...props
}: RowPrimaryActionProps) {
  return (
    <button
      type={type}
      className={clsx(
        'min-h-11 sm:min-h-8 px-3.5 sm:px-3 rounded-xl text-white text-xs font-bold shadow-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        PRIMARY_TONES[tone],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

const ICON_TONES = {
  neutral: 'hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800',
  amber: 'hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50',
  rose: 'hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50',
} as const;

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Required: icon-only buttons need an accessible name. */
  'aria-label': string;
  tone?: keyof typeof ICON_TONES;
}

/** Icon-only button with a 44px touch area on mobile (36px from sm). */
export function IconButton({ icon: Icon, tone = 'neutral', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      title={props['aria-label']}
      className={clsx(
        'size-11 sm:size-9 shrink-0 rounded-xl inline-flex items-center justify-center text-zinc-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        ICON_TONES[tone],
        className
      )}
      {...props}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
