/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coffee: {
          lightBg: "#f7f3ee",
          lightCard: "#ffffff",
          lightText: "#2b2b2b",
          lightAccent: "#c67c4e",
          darkBg: "#1c1816",
          darkCard: "#2a2421",
          darkBorder: "#3a322e",
          darkText: "#f5efe6",
          darkAccent: "#e6a87c",
        },
      },
    },
  },
  plugins: [],
};
