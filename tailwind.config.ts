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
        // Primary teal accent (CTAs, active states, highlights)
        brand: {
          DEFAULT: "#3FEFB4",
          dark:    "#00C48C",
          light:   "#6FF5C3",
        },
        // Secondary amber (warnings, deadlines, urgency)
        secondary: {
          DEFAULT: "#F7A325",
          dark:    "#E8950F",
          light:   "#FFB84D",
        },
        // Backgrounds
        surface: {
          DEFAULT:  "#0B0E14",
          card:     "#141920",
          elevated: "#1C2333",
        },
        // Borders
        border: {
          subtle: "#252D3D",
          strong: "#3A4459",
        },
        // Semantic status
        live:   "#FF3B3B",
        win:    "#21C55D",
        locked: "#4A5568",
        // Text
        text: {
          primary:   "#F0F4FF",
          secondary: "#8A95A8",
          muted:     "#4A5568",
        },
      },
      fontFamily: {
        rajdhani: ["var(--font-rajdhani)", "sans-serif"],
        inter:    ["var(--font-inter)", "sans-serif"],
        sans:     ["var(--font-inter)", "var(--font-rajdhani)", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        // Dot pulse: scale + opacity for live indicators
        livePulse: {
          "0%, 100%": { transform: "scale(1)",   opacity: "1"   },
          "50%":      { transform: "scale(1.3)", opacity: "0.6" },
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)"   },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)"  },
          "20%":      { transform: "translateX(-3px)" },
          "40%":      { transform: "translateX(3px)"  },
          "60%":      { transform: "translateX(-3px)" },
          "80%":      { transform: "translateX(3px)"  },
        },
        ticker: {
          "0%":   { transform: "translateX(0%)"    },
          "100%": { transform: "translateX(-50%)"  },
        },
      },
      animation: {
        shimmer:   "shimmer 1.5s ease-in-out infinite",
        livePulse: "livePulse 1.5s ease-in-out infinite",
        fadeUp:    "fadeUp 0.3s ease-out both",
        shake:     "shake 0.45s ease-in-out",
        ticker:    "ticker 20s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
