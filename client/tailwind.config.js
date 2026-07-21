/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0E16",
        surface: "#11161F",
        surface2: "#1A2029",
        border: "#232B38",
        borderLight: "#2E3745",
        text: "#E7EAEF",
        textDim: "#8891A3",
        textFaint: "#5B6478",
        gold: "#D4A24E",
        goldDim: "#8A6A38",
        accent: {
          green: "#38D9A0",
          greenDim: "#1E5844",
          red: "#F1685E",
          redDim: "#5C2A28",
          amber: "#F2B84B",
          blue: "#6FA8F5",
        },
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
