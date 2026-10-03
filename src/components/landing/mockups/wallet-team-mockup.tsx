'use client';

import { Check, ChevronsUpDown, Home, Mail, Wallet } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { formatCurrency } from '@/lib/formatters';
import { interpolate } from '@/lib/i18n/translator';
import { mockWallet as w, type MockRole } from './fixture';

const card =
  'rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.05),0_12px_32px_-8px_rgba(24,24,27,0.14)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-10px_rgba(0,0,0,0.6)]';

const ROLE_KEY = { OWNER: 'roleOwner', MEMBER: 'roleMember', VIEWER: 'roleViewer' } as const;
const ROLE_CLASS: Record<MockRole, string> = {
  OWNER: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  MEMBER: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  VIEWER: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};
const AVATAR_CLASS: Record<string, string> = {
  m1: 'from-indigo-500 to-violet-500',
  m2: 'from-sky-400 to-emerald-400',
  m3: 'from-amber-400 to-rose-400',
};
const NAME_KEY = { m1: 'memberAJ', m2: 'memberJS', m3: 'memberMK' } as const;

function Avatar({ initials, gradient, size = 'h-9 w-9' }: { initials: string; gradient: string; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[11px] font-black text-white`}>
      {initials}
    </span>
  );
}

export function WalletTeamMockup() {
  const { t } = useTranslation();
  const m = t.landingMock;
  const money = (n: number) => formatCurrency(n, w.currency);
  const owner = w.members.find((x) => x.role === 'OWNER') ?? w.members[0];

  return (
    <div role="img" aria-label={m.teamAriaLabel} className="relative mx-auto w-full max-w-xl">
      <div aria-hidden="true" className="relative px-1 pb-2 pt-2">
        <div className="pointer-events-none absolute inset-x-6 top-10 bottom-0 -z-10 rounded-full bg-gradient-to-br from-indigo-200/50 via-sky-200/40 to-emerald-200/40 blur-3xl dark:from-indigo-500/10 dark:via-sky-500/10 dark:to-emerald-500/10" />

        {/* Wallet switcher pill (hidden on very small screens) */}
        <div className="relative z-10 mb-3 hidden sm:flex">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-black text-zinc-700 shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            <Wallet size={13} className="text-indigo-500" />
            {m.walletsCount}
            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400">
              {m.walletHome} · {m.walletPersonal} · {m.walletTrip}
            </span>
            <ChevronsUpDown size={12} className="text-zinc-400" />
          </span>
        </div>

        {/* Wallet card */}
        <div className={`${card} relative w-[94%] -rotate-1 bg-gradient-to-br from-white to-indigo-50/60 p-4 dark:from-zinc-900 dark:to-indigo-950/30 sm:w-[82%] sm:p-5`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <Home size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-zinc-900 dark:text-zinc-50">{m.householdWallet}</p>
              <p className="text-[10px] font-bold text-zinc-400">{m.monthlyBudgetCaption}</p>
            </div>
            <p className="ml-auto text-xl font-black tabular-nums text-zinc-900 dark:text-zinc-50 sm:text-2xl">{money(w.monthlyBudget)}</p>
          </div>

          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">{m.membersHeading}</p>
          <ul className="mt-2 space-y-2">
            {w.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                <Avatar initials={member.initials} gradient={AVATAR_CLASS[member.id]} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-black text-zinc-800 dark:text-zinc-100">{m[NAME_KEY[member.id as keyof typeof NAME_KEY]]}</span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${ROLE_CLASS[member.role]}`}>{m[ROLE_KEY[member.role]]}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Invite card */}
        <div className={`${card} relative z-10 -mt-6 ml-auto w-[92%] rotate-1 p-4 sm:-mt-10 sm:w-[72%] sm:p-5`}>
          <div className="flex items-start gap-3">
            <Avatar initials={owner.initials} gradient={AVATAR_CLASS[owner.id]} size="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                <Mail size={11} />
                {interpolate(m.inviteFrom, { person: m[NAME_KEY[owner.id as keyof typeof NAME_KEY]] })}
              </p>
              <p className="mt-0.5 text-[13px] font-black leading-snug text-zinc-900 dark:text-zinc-50">
                {interpolate(m.inviteHeading, { wallet: m.householdWallet })}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
              {m.inviteRoleCaption}
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${ROLE_CLASS.MEMBER}`}>{m.roleMember}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-4 py-2 text-[11px] font-black text-white shadow-md shadow-indigo-500/30">
              <Check size={12} />
              {m.accept}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
