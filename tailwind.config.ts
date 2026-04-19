import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        'handwriting': ['Caveat', 'cursive'],
      },
      colors: {
        // ── Celebrait brand palette ──────────────────────────────────
        // Warm violet primary, green CTAs, stone neutrals.
        // Defined once here; use `brand`, `cta`, `surface` in components
        // instead of raw `purple-600` or `gray-50`.
        brand: {
          DEFAULT: '#7a76e8',     // soft blue-violet — primary interactive
          light: '#e5e4f9',       // pale lavender — selected backgrounds
          dark: '#5c57d4',        // deeper violet — hover/pressed
          muted: '#f2f1fb',       // near-white tint — subtle
          foreground: '#ffffff',  // text on brand buttons
        },
        cta: {
          DEFAULT: '#5fd94a',     // bright lime — primary action ("go")
          hover: '#4ac437',       // slightly deeper — hover
          light: '#e0f8db',       // pale green — success backgrounds
          foreground: '#ffffff',
        },
        // Accent palette — semantic usage rules (see UX_STUDIO_TONE.md):
        //   coral = emotion / recipient moments (hearts, personal moments)
        //   amber = celebration / success / sparkle moments
        //   cream = warm neutral surfaces (step backgrounds, card frames)
        //   ink   = premium headings / deep text anchor (not for body)
        accent: {
          coral: '#ff9ec7',      // soft coral — emotion, warmth
          'coral-dark': '#ec4899', // saturated coral — hover / emphasis
          'coral-light': '#ffe4ef', // pale coral wash — backgrounds
          amber: '#fbbf24',      // sunny amber — celebration, success
          'amber-dark': '#f59e0b', // deeper amber — hover
          'amber-light': '#fef3c7', // pale amber wash
        },
        surface: {
          DEFAULT: '#fafaf9',     // stone-50 — page background (warm)
          card: '#ffffff',        // card backgrounds
          muted: '#f5f5f4',       // stone-100 — subtle differentiation
          cream: '#fef7ed',       // warm cream — step backgrounds, frames
        },
        ink: {
          DEFAULT: '#312e81',    // deep violet — premium headings (anchors the palette)
          soft: '#4c4a8a',       // slightly softer variant for sub-headings
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
