/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["'Readex Pro'", "system-ui", "sans-serif"], reading: ["'Noto Naskh Arabic'", "serif"], en: ["Andika", "'Readex Pro'", "sans-serif"], shop: ["Lemonada", "'Readex Pro'", "sans-serif"] },
      colors: {
        ivory: "#F6F3EC", ink: "#1E2A28", olive: "#1F7A6D", gold: "#B8761A", line: "#E6E2DA", muted: "#5F6B68",
        shop: { cream: "#FBF6EE", brown: "#A8683F", ink: "#4A3328", rose: "#C98B8B", night: "#2B1D16", sand: "#EADBC8", line: "#EEE3D6" },
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
