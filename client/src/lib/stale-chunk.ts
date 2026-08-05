// client/src/lib/stale-chunk.ts
//
// Recovery for the classic code-splitting deploy race: the browser holds
// a page built against chunk `card-maker-ABC.js`, we deploy, the file
// becomes `card-maker-XYZ.js`, and the user's next lazy-route navigation
// requests a URL that 404s. React.lazy rejects → error boundary.
//
// The cure is simply to reload — the fresh HTML references the new chunk
// names. The only real hazard is a reload LOOP (if the app were broken
// for another reason), so recovery is one-shot per session and only ever
// fires for import-shaped failures.

const FLAG = 'celebrait:stale-chunk-reload';

/** Does this error look like a failed dynamic import / missing chunk? */
export function isStaleChunkError(err: unknown): boolean {
  const msg =
    typeof err === 'string'
      ? err
      : ((err as any)?.message ?? (err as any)?.toString?.() ?? '');
  const name = (err as any)?.name ?? '';
  return (
    name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg)
  );
}

/** Reload once to pick up the current bundle. Returns true if a reload
 *  was triggered; false when we've already tried this session (so the
 *  caller can fall back to showing the error). */
export function recoverFromStaleChunk(reason: string): boolean {
  try {
    if (sessionStorage.getItem(FLAG)) return false;
    sessionStorage.setItem(FLAG, String(Date.now()));
  } catch {
    /* storage blocked — allow a single reload attempt anyway */
  }
  console.warn(`[STALE-CHUNK] recovering via reload (${reason})`);
  // Cache-bust the document so we can't be handed the same stale HTML.
  const url = new URL(window.location.href);
  url.searchParams.set('_r', String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

/** Clear the guard once the app has rendered successfully, so a future
 *  deploy in the same session can recover too. */
export function clearStaleChunkGuard(): void {
  try {
    sessionStorage.removeItem(FLAG);
    // Tidy the cache-buster out of the address bar.
    const url = new URL(window.location.href);
    if (url.searchParams.has('_r')) {
      url.searchParams.delete('_r');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    /* non-fatal */
  }
}
