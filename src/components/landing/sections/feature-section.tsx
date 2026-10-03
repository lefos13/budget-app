'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface FeatureSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  mockup: React.ReactNode;
  /** Put the mockup on the left on large screens. */
  reverse?: boolean;
}

export function FeatureSection({ id, eyebrow, title, body, points, mockup, reverse = false }: FeatureSectionProps) {
  const headingId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={headingId} className="py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className={`min-w-0 ${reverse ? 'lg:order-2' : ''}`}>
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{eyebrow}</p>
          <h3
            id={headingId}
            className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white text-balance"
          >
            {title}
          </h3>
          <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">{body}</p>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm sm:text-base text-zinc-700 dark:text-zinc-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`min-w-0 ${reverse ? 'lg:order-1' : ''}`}>{mockup}</div>
      </div>
    </section>
  );
}
