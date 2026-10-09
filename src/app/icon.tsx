import { ImageResponse } from 'next/og';
import { BrandMark } from '@/lib/og/brand-mark';

const SIZES = [48, 192, 512] as const;

/* 48px is the browser/search favicon (rounded); 192/512 are full-bleed for the manifest's maskable use. */
export function generateImageMetadata() {
  return SIZES.map((px) => ({ id: String(px), size: { width: px, height: px }, contentType: 'image/png' }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id);
  return new ImageResponse(<BrandMark size={px} radius={px <= 48 ? Math.round(px * 0.22) : 0} />, {
    width: px,
    height: px,
  });
}
