import React from 'react';
import { clsx } from 'clsx';

interface CardHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons/links on the right; they wrap onto their own line when the title needs the width. */
  actions?: React.ReactNode;
  /** Heading level for the title. */
  as?: 'h2' | 'h3';
  className?: string;
}

/*
 * Card title row. Long Greek titles are single wide words, so the title block
 * claims at least 12rem and the actions wrap below it (right-aligned) instead
 * of overlapping it on narrow screens.
 */
export function CardHeader({ icon, title, description, actions, as: Heading = 'h2', className }: CardHeaderProps) {
  return (
    <div className={clsx('flex flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <div className="flex items-center gap-3 min-w-0 flex-1 basis-48">
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="min-w-0">
          <Heading className="text-base font-extrabold text-zinc-900 dark:text-white">{title}</Heading>
          {description && <p className="text-xs text-zinc-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0 ml-auto">{actions}</div>}
    </div>
  );
}
