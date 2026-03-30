import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssTypography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Cash Sans'", "sans-serif"],
        mono: ["monospace"],
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        hairline: "var(--shadow-hairline)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      colors: {
        background: {
          DEFAULT: "var(--color-background-primary)",
          primary: "var(--color-background-primary)",
          secondary: "var(--color-background-secondary)",
          tertiary: "var(--color-background-tertiary)",
          inverse: "var(--color-background-inverse)",
          ghost: "var(--color-background-ghost)",
          info: "var(--color-background-info)",
          danger: "var(--color-background-danger)",
          success: "var(--color-background-success)",
          warning: "var(--color-background-warning)",
          disabled: "var(--color-background-disabled)",
        },
        foreground: {
          DEFAULT: "var(--color-text-primary)",
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          inverse: "var(--color-text-inverse)",
          ghost: "var(--color-text-ghost)",
          info: "var(--color-text-info)",
          danger: "var(--color-text-danger)",
          success: "var(--color-text-success)",
          warning: "var(--color-text-warning)",
          disabled: "var(--color-text-disabled)",
        },
        border: {
          DEFAULT: "var(--color-border-primary)",
          primary: "var(--color-border-primary)",
          secondary: "var(--color-border-secondary)",
          tertiary: "var(--color-border-tertiary)",
          inverse: "var(--color-border-inverse)",
          ghost: "var(--color-border-ghost)",
          info: "var(--color-border-info)",
          danger: "var(--color-border-danger)",
          success: "var(--color-border-success)",
          warning: "var(--color-border-warning)",
          disabled: "var(--color-border-disabled)",
        },
        ring: {
          DEFAULT: "var(--color-ring-primary)",
          primary: "var(--color-ring-primary)",
          secondary: "var(--color-ring-secondary)",
          inverse: "var(--color-ring-inverse)",
          info: "var(--color-ring-info)",
          danger: "var(--color-ring-danger)",
          success: "var(--color-ring-success)",
          warning: "var(--color-ring-warning)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "var(--color-accent-foreground)",
        },
        // Semantic status colors for inline use (status dots, badges)
        green: { 500: "#91cb80" },
        red: { 500: "#f94b4b" },
        yellow: { 500: "#fbcd44" },
      },
      transitionDuration: {
        400: "400ms",
        600: "600ms",
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssTypography],
};
