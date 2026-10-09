/*
 * The Aura Budget mark (Lucide "wallet" on the indigo→sky gradient used by the splash and the
 * landing header), written for `next/og` (Satori): flex layout and inline SVG only, no Tailwind.
 */
export const BRAND_GRADIENT = 'linear-gradient(135deg, #4f46e5, #0ea5e9)';

export function BrandMark({ size, radius = 0 }: { size: number; radius?: number }) {
  const glyph = Math.round(size * 0.56);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundImage: BRAND_GRADIENT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      </svg>
    </div>
  );
}
