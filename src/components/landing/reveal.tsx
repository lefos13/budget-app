'use client';

import React from 'react';
import { useReveal } from './use-reveal';

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Reveal({ children, className = '', ...rest }: RevealProps) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`landing-reveal ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
