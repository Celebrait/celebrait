import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Custom intermediate breakpoint for the awkward 1024–1279 zone
      // (small laptops, smaller external monitors, non-fullscreen
      // browser windows). Tailwind defaults: md=768, lg=1024, xl=1280.
      // The 256px gap between lg and xl is too wide for the landing
      // hero's absolute-positioning + bleed. `lg+` splits the zone:
      //   1024–1139 → use `lg` (treat conservatively)
      //   1140–1279 → use `lg+` (treat as small xl)
      //   1280+     → use `xl`
      screens: {
        'lg+': '1140px',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // `font-display` — Fraunces serif, on TEST for landing headlines.
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
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
          // Bright lime green — the "go" colour (Kevin locked the original
          // #5fd94a after A/B-ing grass + pastel 2026-07-09). Drives BOTH the
          // super-important "go" buttons and the green readiness accents.
          DEFAULT: '#5fd94a',     // bright lime — go actions + readiness accent
          hover: '#4ac437',       // slightly deeper — hover
          light: '#e0f8db',       // pale green — readiness backgrounds
          foreground: '#ffffff',
        },
        // ── `go` = the ACTION-BUTTON treatment (2026-07-09) ───────────
        // Split out of `cta` so we can A/B the primary-button colour
        // (ink vs violet vs green) WITHOUT disturbing green where it
        // earns its place as a status accent (Ready column, ready dots).
        // CSS-var backed → flip live via the Dev-tools "Button colour"
        // switcher (sets data-go on <html>); default is ink (index.css).
        // Once the treatment is decided, bake the winner into index.css
        // and retire the switcher.
        go: {
          DEFAULT: 'var(--go)',
          hover: 'var(--go-hover)',
          foreground: 'var(--go-fg)',
        },
        // Accent palette — semantic usage rules (see UX_STUDIO_TONE.md):
        //   coral = emotion / recipient moments (hearts, personal moments)
        //   amber = celebration / success / sparkle moments
        //   red   = warning / failure (warm dusty brick — NOT SaaS error red)
        //   cream = warm neutral surfaces (step backgrounds, card frames)
        //   ink   = premium headings / deep text anchor (not for body)
        accent: {
          // Merged with the shadcn DEFAULT/foreground further down in
          // this same `colors` block to avoid the duplicate-key bug
          // (last `accent:` would clobber the first per JS object
          // semantics, killing the whole custom accent palette).
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          // ⚠️ LEGACY LANDING ONLY — coral + amber below. The STUDIO (Keeper
          // skin) retired the rainbow: use violet (brand), green (cta), or
          // ember (accent-red) instead. Do NOT use coral/amber on any studio
          // surface. These stay only because the OLD landing sections + a few
          // /keeper-shared sections (faq, imagine-describe-ship) still use
          // them; slated for removal when /keeper replaces / and those get
          // re-skinned. See next_studio_keeper_skin + next_lp_keeper_blueprint.
          coral: '#ff9ec7',      // soft coral — emotion, warmth
          'coral-dark': '#ec4899', // saturated coral — hover / emphasis
          'coral-light': '#ffe4ef', // pale coral wash — backgrounds
          amber: '#fbbf24',      // sunny amber — celebration, success
          'amber-dark': '#f59e0b', // deeper amber — hover
          'amber-light': '#fef3c7', // pale amber wash
          // Ember — refined warm terracotta for warnings/failures under
          // the Keeper palette (2026-07-09, replaced the muddy dusty-brick
          // #b94a44 Kevin rejected). Cleaner + brighter, reads warm-but-
          // intentional on paper. Sits as the ONE warm accent in an
          // otherwise paper/ink/violet/green system. Use sparingly:
          // warning / failure / "wait, look at this" only. NEVER for
          // destructive ("delete") confirmation — that keeps the separate
          // system danger-red, so this ember doesn't dilute that signal.
          red: '#c15b43',        // ember terracotta — primary warning
          'red-dark': '#a6432e', // deep clay — text/icon glyph
          'red-light': '#f6e7e1', // pale ember wash — backgrounds
        },
        // THE KEEPER landing palette (locked 2026-07-04, judge's pick from
        // the LP panel — see next_lp_keeper_blueprint.md). Gallery
        // neutrals + ONE marigold accent; kills the pinky-Replit read and
        // flatters skin tones on a face-led page. Landing-scope for now;
        // candidate for brand-wide adoption after Kevin sees it live.
        keeper: {
          paper: '#FAF8F4',      // warm paper white — page ground
          ink: '#211D19',        // warm near-black — text + the one dark band
          stone: '#7A7267',      // warm secondary text
          hair: '#E5DFD4',       // hairline borders
          // Accent = the EXISTING brand violet (Kevin killed the judge's
          // marigold on sight, 2026-07-04 — "wtf is that gold"; it also
          // fought the violet header = two accent families on one screen).
          // ONE accent site-wide: the violet the logo/studio already own.
          // Class names keep the gold- prefix until the palette pass renames.
          gold: '#5c57d4',       // accent — eyebrows, persona word, links (= brand.dark for paper contrast)
          'gold-deep': '#4a45c0',// hover / pressed
          'gold-wash': '#EDECFA',// pale wash — chips, tags
        },
        surface: {
          DEFAULT: '#fafaf9',     // stone-50 — page background (warm)
          card: '#ffffff',        // card backgrounds
          muted: '#f5f5f4',       // stone-100 — subtle differentiation
          // ⚠️ LEGACY LANDING ONLY — studio uses keeper-paper. `surface-cream`
          // survives only in the OLD landing sections + parked style-step;
          // remove when /keeper replaces /. Don't use on studio surfaces.
          cream: '#fef7ed',       // warm cream — step backgrounds, frames
        },
        ink: {
          // Dark neutral anchor for body text + headings. Was deep violet
          // originally, but that made the whole flow read as a sea of
          // purple when combined with the brand + ink-soft. Premium brands
          // in this space (Moonpig / Papier / Paperless Post) use a dark
          // neutral and let their brand colour signal actions + accents.
          DEFAULT: '#0f172a',    // slate-900 — body, headings, selected labels
          soft: '#475569',       // slate-600 — secondary sub-headings / body-lite
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
        // NOTE: shadcn-style `accent: { DEFAULT, foreground }` merged
        // into the custom accent palette above (line ~48) to avoid a
        // duplicate-key bug that silently dropped the entire custom
        // palette. If you re-introduce a second `accent:` block here,
        // every accent-coral / accent-amber / accent-red class will
        // stop compiling.
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
