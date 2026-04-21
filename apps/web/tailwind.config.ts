import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101418",
        mist: "#f4efe6",
        ember: "#ff6b35",
        tide: "#0d3b66",
        mint: "#89b0ae"
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Avenir Next", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "IBM Plex Sans", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 60px rgba(16, 20, 24, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;

