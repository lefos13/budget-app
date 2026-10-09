'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { parseISO } from 'date-fns';

const LandingTodayContext = createContext<string | null>(null);

/*
 * The prerendered landing passes the server's `yyyy-MM-dd` so mockups and the footer year render
 * the same date on the server and in the browser (no hydration mismatch); the page regenerates
 * daily. Without a provider (the client-only fallback landing in the app) it is simply today.
 */
export function LandingTodayProvider({ today, children }: { today?: string; children: React.ReactNode }) {
  return <LandingTodayContext.Provider value={today ?? null}>{children}</LandingTodayContext.Provider>;
}

export function useLandingToday(): Date {
  const today = useContext(LandingTodayContext);
  return useMemo(() => (today ? parseISO(today) : new Date()), [today]);
}
