'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, innermost last. */
const openDialogs: symbol[] = [];

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' } as const;

interface DialogProps {
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Icon tile left of the title. */
  icon?: React.ReactNode;
  /** Pinned action bar (Cancel / Submit). Children stretch on mobile. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  size?: keyof typeof SIZES;
  /** False while submitting: blocks Escape, backdrop and the close button. */
  dismissible?: boolean;
  /** 'right' = full-height side drawer from sm (day agenda); always a bottom sheet below sm. */
  placement?: 'center' | 'right';
  /** Stacked dialogs (opened from inside another dialog) sit one layer higher. */
  stacked?: boolean;
  /** When set, the panel is a <form> so footer submit buttons submit it. */
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
}

/*
 * The one modal shell. Below sm it is a bottom sheet (full width, rounded top,
 * max 90dvh, scrolling body, footer pinned above the home indicator); from sm it
 * is a centred dialog or a right-hand drawer. It owns Escape, backdrop click,
 * page scroll lock and returning focus to the opener.
 */
export function Dialog({
  onClose,
  title,
  description,
  icon,
  footer,
  children,
  size = 'md',
  dismissible = true,
  placement = 'center',
  stacked = false,
  onSubmit,
  className,
}: DialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);

  // Captured during the first render, before children with autoFocus take focus.
  const [opener] = useState(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)
  );

  // Latest values without re-running the mount effect on every render.
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    closeRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  /*
   * Mount-only: register on the open-dialog stack (only the top one reacts to
   * Escape/Tab, so a stacked dialog never closes its parent), trap Tab inside
   * the panel, lock page scroll, and hand focus back to the opener on close.
   */
  useEffect(() => {
    const token = Symbol('dialog');
    openDialogs.push(token);
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== token || !panel) return;
      if (e.key === 'Escape') {
        if (dismissibleRef.current) closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only; latest props are read via refs
  }, []);

  const isRight = placement === 'right';
  const Panel = onSubmit ? 'form' : 'div';

  return (
    <div
      className={clsx(
        'fixed inset-0 flex items-end bg-zinc-950/60 backdrop-blur-xs',
        stacked ? 'z-[60]' : 'z-50',
        isRight ? 'sm:items-stretch sm:justify-end' : 'sm:items-center sm:justify-center sm:p-4'
      )}
    >
      <div className="absolute inset-0" aria-hidden="true" onClick={() => dismissible && onClose()} />
      <Panel
        ref={panelRef as React.Ref<HTMLFormElement & HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onSubmit={onSubmit}
        className={clsx(
          'dialog-panel relative flex flex-col w-full max-h-[90dvh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-t-3xl outline-none',
          isRight
            ? 'sm:max-w-md sm:max-h-none sm:h-full sm:rounded-none sm:border-y-0 sm:border-r-0'
            : clsx('sm:rounded-3xl', SIZES[size]),
          className
        )}
      >
        <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" aria-hidden="true" />

        <header className="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-3 sm:pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <div className="shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-bold text-zinc-900 dark:text-white">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-xs text-zinc-500 mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label={t('common.close')}
            className="-mr-2 -mt-1 size-11 sm:size-9 shrink-0 rounded-xl inline-flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4">{children}</div>

        {footer && (
          <footer className="shrink-0 flex items-center justify-end gap-2 px-5 sm:px-6 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border-t border-zinc-100 dark:border-zinc-800 [&>*]:flex-1 sm:[&>*]:flex-none [&>*]:min-h-11 sm:[&>*]:min-h-0">
            {footer}
          </footer>
        )}
      </Panel>
    </div>
  );
}
