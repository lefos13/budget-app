import type { ReactNode } from 'react';

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className = '' }: PhoneFrameProps) {
  return (
    <div
      className={`relative aspect-[9/19] w-full overflow-hidden rounded-[2.5rem] border-[6px] border-zinc-900 bg-white shadow-[0_30px_60px_-15px_rgba(24,24,27,0.45),0_0_0_1px_rgba(255,255,255,0.06)] dark:border-zinc-700 dark:bg-zinc-950 ${className}`}
    >
      <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-black" />
      <div className="h-full w-full pt-9">{children}</div>
    </div>
  );
}
