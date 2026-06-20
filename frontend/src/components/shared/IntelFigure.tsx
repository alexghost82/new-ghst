import type { CSSProperties } from "react";

interface IntelFigureProps {
  /** Public asset path, e.g. "/brand/standup.jpg". */
  src: string;
  /**
   * Accessible description. Required for content images. Pass an empty string
   * for purely decorative imagery (the figure is then marked aria-hidden).
   */
  alt: string;
  /** CSS aspect-ratio, e.g. "16/10", "3/2", "21/9". Default "16/10". */
  ratio?: string;
  /** Tactical mono-uppercase badge shown top-start (English, brand signature). */
  badge?: string;
  /** Bottom readability gradient. Default true. */
  overlay?: boolean;
  /**
   * Keep a face region permanently desaturated/obscured (identity protected).
   * Adds a masked grayscale copy over the upper-center, plus an
   * "Identity protected" chip unless a custom badge is provided.
   */
  faceProtect?: boolean;
  /** Load eagerly (above the fold). Default false → lazy. */
  priority?: boolean;
  /** Extra classes on the <figure>. */
  className?: string;
  /** Extra classes on the <img>. */
  imgClassName?: string;
  style?: CSSProperties;
}

/**
 * IntelFigure — the canonical Ghost marketing image frame.
 *
 * Brand line (ata-motag): images read as VISINT — desaturated cool grayscale at
 * rest, colorizing on hover (~700ms), inside a subtle surface frame with a
 * tactical mono badge. Color is never decorative here; it is the "reveal".
 */
export default function IntelFigure({
  src,
  alt,
  ratio = "16/10",
  badge,
  overlay = true,
  faceProtect = false,
  priority = false,
  className = "",
  imgClassName = "",
  style,
}: IntelFigureProps) {
  const decorative = alt.trim() === "";
  const chip = badge ?? (faceProtect ? "Identity protected" : undefined);

  return (
    <figure
      aria-hidden={decorative || undefined}
      className={`group relative overflow-hidden rounded-2xl border border-ghost-border-subtle bg-ghost-bg ${className}`}
      style={{ aspectRatio: ratio, ...style }}
    >
      {/* Base image — grayscale at rest, colorizes on hover. Always LTR. */}
      <img
        src={src}
        alt={decorative ? "" : alt}
        aria-hidden={decorative || undefined}
        loading={priority ? "eager" : "lazy"}
        draggable={false}
        dir="ltr"
        className={`absolute inset-0 w-full h-full object-cover transition-[transform,filter] duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] [filter:grayscale(1)_contrast(1.05)] group-hover:[filter:grayscale(0)_contrast(1)] ${imgClassName}`}
      />

      {/* Face mask — permanently desaturated copy clipped to the upper-center,
          so an obscured face region never colorizes. */}
      {faceProtect && (
        <img
          src={src}
          alt=""
          aria-hidden
          loading={priority ? "eager" : "lazy"}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] [filter:grayscale(1)]"
          style={{
            WebkitMaskImage:
              "radial-gradient(42% 30% at 50% 26%, #000 58%, transparent 100%)",
            maskImage:
              "radial-gradient(42% 30% at 50% 26%, #000 58%, transparent 100%)",
          }}
        />
      )}

      {/* Bottom readability gradient. */}
      {overlay && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none bg-gradient-to-t from-ghost-bg via-ghost-bg/25 to-transparent"
        />
      )}

      {/* Tactical mono badge. */}
      {chip && (
        <figcaption
          dir="ltr"
          className="absolute top-3 left-3 z-10 inline-flex items-center h-6 px-2.5 rounded-full bg-black/45 backdrop-blur-md ring-1 ring-white/10 font-mono text-[9px] tracking-[0.18em] uppercase text-white/90"
        >
          {chip}
        </figcaption>
      )}
    </figure>
  );
}
