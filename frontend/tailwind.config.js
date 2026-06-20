/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "475px",
      },
      colors: {
        ghost: {
          bg: "rgb(var(--ghost-bg) / <alpha-value>)",
          "bg-secondary": "rgb(var(--ghost-bg-secondary) / <alpha-value>)",
          sidebar: "rgb(var(--ghost-sidebar) / <alpha-value>)",
          surface: "rgb(var(--ghost-surface) / <alpha-value>)",
          "surface-hover": "rgb(var(--ghost-surface-hover) / <alpha-value>)",
          "text-primary": "rgb(var(--ghost-text-primary) / <alpha-value>)",
          "text-secondary": "rgb(var(--ghost-text-secondary) / <alpha-value>)",
          "text-muted": "rgb(var(--ghost-text-muted) / <alpha-value>)",
          "border-subtle": "rgb(var(--ghost-border-subtle) / <alpha-value>)",
          accent: "rgb(var(--ghost-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--ghost-accent-hover) / <alpha-value>)",
          bronze: "rgb(var(--ghost-bronze) / <alpha-value>)",
          error: "rgb(var(--ghost-error) / <alpha-value>)",
          success: "rgb(var(--ghost-success) / <alpha-value>)",
        },
        // Retro CRT terminal palette — used only by the hidden "secure terminal"
        // variant of the Secure Access screen (unlocked via the 1+4+8 chord).
        terminal: {
          bg: "#000000",
          green: "#33ff66",
          "green-dim": "#1f9c3f",
          amber: "#ffb000",
          red: "#ff3b30",
          cyan: "#27d3e8",
        },
      },
      width: {
        sidebar: "260px",
        panel: "320px",
      },
      maxWidth: {
        chat: "768px",
      },
      fontSize: {
        body: ["16px", { lineHeight: "1.75" }],
        small: ["14px", { lineHeight: "1.5" }],
        title: ["16px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Apple Color Emoji"',
          "sans-serif",
        ],
        sf: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"IBM Plex Mono"',
          "ui-monospace",
          '"Cascadia Code"',
          "Menlo",
          "Consolas",
          "monospace",
        ],
        vt: ["'VT323'", "'IBM Plex Mono'", "'Courier New'", "monospace"],
        he: [
          '"Heebo"',
          '"Assistant"',
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Arial",
          "sans-serif",
        ],
        raanana: [
          '"Raanana"',
          '"Heebo"',
          '"Assistant"',
          "ui-sans-serif",
          "-apple-system",
          "sans-serif",
        ],
        serif: [
          '"Georgia"',
          '"Times New Roman"',
          "ui-serif",
          "Cambria",
          "serif",
        ],
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s infinite ease-in-out both",
        "splash-in": "splashIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        blink: "blink 1s step-end infinite",
        flicker: "flicker 4s linear infinite",
        scanline: "scanline 7s linear infinite",
        glitch: "glitch 0.35s steps(2) infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 80%, 100%": { transform: "scale(0.4)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.82" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.9" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        glitch: {
          "0%": { clipPath: "inset(0 0 0 0)", transform: "translate(0)" },
          "20%": {
            clipPath: "inset(20% 0 40% 0)",
            transform: "translate(-2px,1px)",
          },
          "40%": {
            clipPath: "inset(60% 0 10% 0)",
            transform: "translate(2px,-1px)",
          },
          "60%": {
            clipPath: "inset(10% 0 70% 0)",
            transform: "translate(-1px,1px)",
          },
          "80%": {
            clipPath: "inset(40% 0 30% 0)",
            transform: "translate(1px,-1px)",
          },
          "100%": { clipPath: "inset(0 0 0 0)", transform: "translate(0)" },
        },
      },
    },
  },
  plugins: [],
};
