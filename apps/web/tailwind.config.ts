import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#0066cc",
          "blue-dark": "#004999",
          "blue-focus": "#0071e3",
          "blue-on-dark": "#2997ff",
        },
        ink: {
          DEFAULT: "#1d1d1f",
          80: "#333333",
          48: "#7a7a7a",
        },
        canvas: {
          DEFAULT: "#ffffff",
          parchment: "#f5f5f7",
          pearl: "#fafafc",
        },
        surface: {
          black: "#000000",
          tile1: "#272729",
          tile2: "#2a2a2c",
          tile3: "#252527",
          chip: "#d2d2d7",
        },
        divider: {
          soft: "#f0f0f0",
          hairline: "#e0e0e0",
        },
        risk: {
          high: "#dc2626",
          medium: "#d97706",
          low: "#16a34a",
        },
      },
      fontFamily: {
        display: ['"SF Pro Display"', "system-ui", "-apple-system", "sans-serif"],
        sans: ['"SF Pro Text"', "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
