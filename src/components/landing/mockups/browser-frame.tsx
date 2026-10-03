import type { ReactNode } from 'react';

interface BrowserFrameProps {
  url: string;
  children: ReactNode;
  className?: string;
}

export function BrowserFrame({ url, children, className = '' }: BrowserFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_2px_4px_rgba(24,24,27,0.04),0_24px_48px_-12px_rgba(24,24,27,0.18),0_60px_120px_-30px_rgba(79,70,229,0.25)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7),0_60px_120px_-30px_rgba(99,102,241,0.25)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto w-full max-w-[220px] rounded-full border border-zinc-200 bg-white px-3 py-1 text-center text-[10px] font-bold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-500">
          {url}
        </div>
        <div className="w-10" />
      </div>
      {children}
    </div>
  );
}
