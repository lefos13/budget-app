import { ImageResponse } from 'next/og';
import { BrandMark } from '@/lib/og/brand-mark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/* Full-bleed: iOS applies its own rounded mask. */
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={size.width} />, size);
}
