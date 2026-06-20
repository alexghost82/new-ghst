import type { ReactNode } from "react";

// CRT screen shell: paints the black terminal background, the moving scan bar,
// and (via the `.crt` class in index.css) the static scanline overlay + screen
// vignette. The inner layer carries a slow flicker so the whole surface reads
// like an old phosphor monitor.
export function CRT({ children }: { children: ReactNode }) {
  return (
    <div className="crt fixed inset-0 bg-terminal-bg">
      <div className="scan-bar" />
      <div className="relative z-10 h-full w-full animate-flicker">
        {children}
      </div>
    </div>
  );
}

export default CRT;
