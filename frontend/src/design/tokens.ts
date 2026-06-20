export const colors = {
  bg: {
    primary: "#0f0f10",
    secondary: "#18181b",
    sidebar: "#141416",
    surface: "#1c1c1f",
    surfaceHover: "#232326",
  },
  text: {
    primary: "#f4f4f5",
    secondary: "#a1a1aa",
    muted: "#71717a",
  },
  border: {
    subtle: "#27272a",
  },
  accent: {
    primary: "#3b82f6",
    hover: "#2563eb",
    ghost: "#8B7355",
  },
  state: {
    error: "#ef4444",
    success: "#22c55e",
  },
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
  md: "0 4px 12px rgba(0, 0, 0, 0.4)",
  lg: "0 8px 24px rgba(0, 0, 0, 0.5)",
  panel: "0 0 40px rgba(0, 0, 0, 0.6)",
} as const;

export const typography = {
  body: {
    fontSize: "15px",
    lineHeight: "1.6",
  },
  small: {
    fontSize: "13px",
    lineHeight: "1.5",
  },
  title: {
    fontSize: "16px",
    lineHeight: "1.4",
    fontWeight: "500",
  },
  fontFamily:
    'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

export const layout = {
  sidebarWidth: "260px",
  chatMaxWidth: "780px",
  panelWidth: "360px",
  messageMaxWidth: "70%",
} as const;

export const transitions = {
  fast: "100ms ease",
  normal: "160ms ease",
  slow: "300ms ease",
} as const;
