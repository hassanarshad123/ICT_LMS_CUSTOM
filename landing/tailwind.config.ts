import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zen: {
          dark: "#181229",
          "dark-80": "#181229cc",
          "deep-blue": "#2f2f91",
          gold: "#f5c543",
          "light-gold": "#ffda75",
          "soft-green": "#c5e2ca",
          purple: "#8a6aa4",
          "soft-pink": "#f8dfdd",
          bg: "#fcfaf9",
          border: "#e9e3dd",
          darkest: "#25172a",
          orange: "#fe6621",
          "light-purple": "#d4c4ee",
          "lightest-pink": "#f7f1f0",
          "warm-light": "#fffbf4",
          "page-bg": "#f3f0ed",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float-delayed 5s ease-in-out 1s infinite",
        "float-slow": "float 8s ease-in-out 2s infinite",
        "pulse-live": "pulse-live 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
