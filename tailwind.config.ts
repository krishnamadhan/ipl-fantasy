import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F5A623",
          dark:    "#E8950F",
          light:   "#FFB84D",
        },
        surface: {
          DEFAULT:  "#080D1A",
          card:     "#111827",
          elevated: "#1A2235",
        },
        live: "#FF3B3B",
        win:  "#22C55E",
      },
      fontFamily: {
        rajdhani: ["var(--font-rajdhani)", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        livePulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%":      { transform: "translateX(-3px)" },
          "40%":      { transform: "translateX(3px)" },
          "60%":      { transform: "translateX(-3px)" },
          "80%":      { transform: "translateX(3px)" },
        },
      },
      animation: {
        shimmer:    "shimmer 1.4s infinite linear",
        livePulse:  "livePulse 1.8s ease-in-out infinite",
        fadeUp:     "fadeUp 0.3s ease-out",
        shake:      "shake 0.45s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
