import { useThemeStore } from "../../stores/themeStore";

interface GhostIconProps {
  /** Rendered square size in px. */
  size?: number;
  className?: string;
}

/**
 * Canonical Ghost brand mark.
 *
 * HARD UI RULE (see .cursor/rules/ghost-icon-no-wrapper.mdc): the icon is
 * ALWAYS rendered bare — its own rounded tile, color-correct per theme. The
 * asset is a rounded tile on a light backdrop; in dark mode it is inverted so
 * that backdrop blends into the page (otherwise its light corners read as an
 * ugly square). NEVER wrap it in a decorative frame (border / background /
 * ring / shadow) and never reshape it (e.g. into a circle).
 */
export default function GhostIcon({ size = 32, className = "" }: GhostIconProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <img
      src="/ghost-icon.png"
      alt="Ghost"
      draggable={false}
      style={{ width: size, height: size }}
      className={`object-contain${theme === "dark" ? " invert" : ""}${
        className ? ` ${className}` : ""
      }`}
    />
  );
}
