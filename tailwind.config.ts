import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff5f3",
          100: "#ffe3de",
          500: "#c2412d",
          600: "#a83222",
          700: "#852719",
        },
      },
    },
  },
  plugins: [],
};

export default config;
