// client/src/lib/friendly-error.ts
//
// One place that turns whatever a failed request threw into a sentence a
// customer can read. The audit (2026-10-06) found raw transport strings
// ("Failed to fetch"), infra internals ("Upload failed: R2 put timed
// out"), JSON blobs (`404: {"message":…}`) and image-vendor boilerplate
// reaching toasts and inline errors. Everything customer-facing should
// go through here; admin pages deliberately don't (they want the raw
// error).

import { getErrorStatus } from './queryClient';

export const NETWORK_COPY = "We couldn't reach Celebrait. Check your connection and try again.";
export const OUR_SIDE_COPY = "Something went wrong on our side. Try again in a moment. You haven't been charged.";
const SIGN_IN_COPY = 'Please sign in again.';
const NOT_FOUND_COPY = "We couldn't find that.";
const SLOW_DOWN_COPY = 'Slow down a little and try again in a minute.';
const DEFAULT_FALLBACK = 'Something went wrong. Try again in a moment.';

// Browser fetch failures: Chrome / Firefox / Safari wording, plus aborts.
// Word-bounded: "Upload failed: …" must not read as Safari's "Load failed".
const NETWORK_RE = /\bfailed to fetch\b|\bnetworkerror\b|\bnetwork request failed\b|\bload failed\b|network connection was lost|internet connection/i;
// Infra and vendor words a customer must never read ("we", not "AI").
const INTERNALS_RE = /\b(r2|timed? ?out|timeout|openai|gpt|flux|replicate|fal|gemini|bfl|imagen|stability|postgres|ECONN\w*|ETIMEDOUT|socket hang up)\b/i;

/** The server's `message` out of a raw error string, if it carries one:
 *  "404: {"message":"Draft not found"}" → "Draft not found". */
function serverMessage(raw: string): string {
  let text = raw.trim();
  const prefixed = /^\d{3}:\s*([\s\S]*)$/.exec(text);
  if (prefixed) text = prefixed[1].trim();
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
      if (typeof parsed.message === 'string') return parsed.message;
      if (typeof parsed.error === 'string') return parsed.error;
      return '';
    } catch {
      return '';
    }
  }
  return text;
}

/** Does this read like a sentence written for a person, not a log line? */
function readsHuman(text: string): boolean {
  if (!text || text.length >= 200) return false;
  if (/[{}<>[\]]/.test(text)) return false;
  if (/^\d{3}\b/.test(text)) return false; // bare status code / "500: …"
  if (/^(Type|Reference|Syntax|Range)Error\b|\bat\s+\w+\s*\(/.test(text)) return false; // JS error / stack
  if (/^[A-Z0-9_]{4,}$/.test(text)) return false; // ERROR_CODE
  if (!/[a-z]/i.test(text)) return false;
  return true;
}

/**
 * Customer-safe copy for any thrown value. Network failures, auth, not
 * found, rate limits and anything that smells of our infrastructure or
 * an image vendor get fixed copy; a plain server sentence passes through;
 * anything else becomes `fallback`.
 */
export function friendlyError(err: unknown, fallback: string = DEFAULT_FALLBACK): string {
  const e = err as { name?: unknown; message?: unknown } | null | undefined;
  const raw =
    typeof err === 'string' ? err
    : e && typeof e.message === 'string' ? e.message
    : '';
  const name = e && typeof e.name === 'string' ? e.name : '';

  // 1. Couldn't reach us at all (fetch TypeError, abort, offline).
  if (name === 'AbortError' || name === 'TimeoutError' || NETWORK_RE.test(raw)) return NETWORK_COPY;
  if (err instanceof TypeError && !raw) return NETWORK_COPY;

  // 2. The status says it all.
  const status = getErrorStatus(err);
  if (status === 401) return SIGN_IN_COPY;
  if (status === 404) return NOT_FOUND_COPY;
  if (status === 429) return SLOW_DOWN_COPY;
  if (status !== undefined && status >= 500) return OUR_SIDE_COPY;

  // 3. Whatever the server said — unless it leaks internals.
  const message = serverMessage(raw);
  if (INTERNALS_RE.test(message) || INTERNALS_RE.test(raw)) return OUR_SIDE_COPY;
  if (readsHuman(message)) return message;
  return fallback;
}
