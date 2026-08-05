/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        display: ["'Syne'", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        ink: {
          50: "#f4f7f6",
          100: "#e3ebe8",
          200: "#c5d5cf",
          700: "#2a3d38",
          800: "#1a2a26",
          900: "#101c19",
          950: "#0a1311",
        },
        // Tremor color palette (required for charts/badges)
        tremor: {
          brand: {
            faint: "#ecfdf5",
            muted: "#a7f3d0",
            subtle: "#34d399",
            DEFAULT: "#059669",
            emphasis: "#047857",
            inverted: "#ffffff",
          },
          background: {
            muted: "#f8fafc",
            subtle: "#f1f5f9",
            DEFAULT: "#ffffff",
            emphasis: "#334155",
          },
          border: {
            DEFAULT: "#e2e8f0",
          },
          ring: {
            DEFAULT: "#e2e8f0",
          },
          content: {
            subtle: "#94a3b8",
            DEFAULT: "#64748b",
            emphasis: "#334155",
            strong: "#0f172a",
            inverted: "#ffffff",
          },
        },
      },
      boxShadow: {
        "dash-sm": "0 1px 2px rgba(15, 28, 25, 0.04), 0 1px 3px rgba(15, 28, 25, 0.06)",
        dash: "0 1px 2px rgba(15, 28, 25, 0.04), 0 8px 24px -6px rgba(15, 28, 25, 0.12)",
        "dash-lg":
          "0 2px 4px rgba(15, 28, 25, 0.04), 0 16px 40px -12px rgba(15, 28, 25, 0.18)",
        glow: "0 0 0 1px rgba(16, 185, 129, 0.12), 0 0 24px -4px rgba(16, 185, 129, 0.35)",
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card":
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown":
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        shimmer: "shimmer 2.2s ease-in-out infinite",
        "soft-pulse": "soft-pulse 3s ease-in-out infinite",
      },
      backgroundImage: {
        "mesh-main":
          "radial-gradient(1200px 600px at 10% -10%, rgba(16, 185, 129, 0.14), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(14, 116, 144, 0.1), transparent 50%), radial-gradient(700px 400px at 50% 100%, rgba(245, 158, 11, 0.06), transparent 45%)",
        "sidebar-glow":
          "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(52, 211, 153, 0.18), transparent 55%)",
      },
    },
  },
  safelist: [
    {
      pattern:
        /^(bg|text|border|ring)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand|ink)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ["hover", "ui-selected"],
    },
  ],
  plugins: [require("flowbite/plugin")],
};
