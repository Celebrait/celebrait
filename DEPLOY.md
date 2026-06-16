# Deploying Celebrait to a test server (Render)

A plain-English walkthrough to get the app onto a live URL you can open on
your phone. ~15 minutes. You do the account/secret steps; the repo is
already configured (see `render.yaml`).

## What you'll need handy
Copy these three values out of your local `.env` file (in the project root)
— you'll paste them into Render:
- `DATABASE_URL`  (your Neon database connection string)
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`

> Tip: a test server pointed at your existing Neon `DATABASE_URL` shares the
> same data as local dev. That's usually fine for testing. If you'd rather
> keep it separate, create a new branch/database in Neon and use that URL.

## Steps

1. **Make a Render account** — go to https://render.com and sign up
   (use "Sign in with GitHub" — it makes connecting the repo one click).

2. **New Blueprint** — in the Render dashboard: **New +** → **Blueprint**.

3. **Connect the repo** — pick `Celebrait/celebrait`. If Render asks for
   GitHub permission, approve it. Render finds `render.yaml` automatically.

4. **Fill in the secrets** — Render shows a field for each `sync: false`
   value. Paste:
   - `DATABASE_URL` → your Neon string
   - `GEMINI_API_KEY` → your key
   - `OPENAI_API_KEY` → your key
   - `PUBLIC_APP_ORIGIN` → leave blank for now (we set it in step 7)
   (`SESSION_SECRET` is generated for you; payments/print are already stubbed.)

5. **Apply / Create** — Render builds (`npm run build`) and starts
   (`npm start`). First build takes a few minutes. Watch the log; it's done
   when you see `serving on 0.0.0.0:<port>`.

6. **Open your URL** — Render gives you something like
   `https://celebrait.onrender.com`. Open it on desktop and your phone.

7. **Set `PUBLIC_APP_ORIGIN`** — in the service's **Environment** tab, set
   `PUBLIC_APP_ORIGIN` to that exact URL, then save (it redeploys). This
   makes share links and redirects use the right address.

## Notes & gotchas
- **Free plan sleeps when idle** — first visit after a quiet spell takes
  ~30s to wake. Normal for testing; upgrade to a paid instance later for
  always-on.
- **Heavy 3D/face-detection bundles** load when you open the studio — keep
  an eye on load time on mobile.
- **Email is off** until you add the `BREVO_*` + `MAIL_FROM_*` vars.
- **Google sign-in is off** until you add the `GOOGLE_*` vars AND register
  `<your Render URL>/api/auth/google/callback` as an authorized redirect in
  the Google Cloud console. Email sign-in works without this.
- **Not for real customers yet**: payment is a stub and print orders aren't
  actually submitted — this is a test/preview server only.
- **Auto-deploy**: every push to `claude/nice-rosalind-171f52` redeploys
  automatically.
