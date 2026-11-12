// Shared bits for the demo harnesses.
export const BASE = process.env.DEMO_BASE ?? 'http://localhost:5050';
export const EMAIL = process.env.DEMO_EMAIL ?? 'aidanchant26@gmail.com';

/** Dev OTP sign-in. Leaves the page signed in as admin. */
export async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (email) => {
    await fetch('/api/auth/otp/send', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    await fetch('/api/auth/otp/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code: '000000' }) });
  }, EMAIL);
}

export const api = (page, method, path, body) => page.evaluate(
  async ([method, path, body]) => {
    const res = await fetch(path, {
      method, credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try { return { status: res.status, body: JSON.parse(text) }; }
    catch { return { status: res.status, body: text }; }
  }, [method, path, body ?? null]);

export const state = (page) => page.evaluate(() => window.__demo?.state ?? 'idle');

/** Whatever the run is showing in its error banner, if anything. */
export const bannerError = (page) => page.evaluate(() => {
  const el = document.querySelector('section p.text-accent-red-dark, .text-accent-red-dark');
  return el ? el.textContent.trim() : null;
});
