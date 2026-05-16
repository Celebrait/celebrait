import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// ── Neon WebSocket crash resilience ───────────────────────────────────
// Bug: the Neon serverless driver opens a WebSocket per connection. When
// the laptop sleeps or the network drops, the WS errors with ETIMEDOUT
// / ECONNRESET / EADDRNOTAVAIL. The driver doesn't always catch these
// synchronously, so they surface as unhandledRejection / uncaughtException
// on the Node process — which kills the dev server.
//
// History: this killed the dev server multiple times during PR1
// testing (2026-04-28 sessions). Memory note:
// `bug_session_store_neon_coldstart.md`. Was POST-LAUNCH-fix until Kevin
// promoted it during testing because it kept interrupting work.
//
// Fix layers (best-effort, defensive):
//
//   1. pool.on('error', ...) — Neon's Pool emits 'error' for
//      connection-level failures. If unhandled, these propagate to
//      uncaughtException. Catch + log.
//
//   2. process.on('unhandledRejection', ...) — catches promise
//      rejections that the driver didn't await. Filter for Neon
//      WebSocket signatures and swallow; rethrow anything else so
//      real bugs aren't masked.
//
//   3. process.on('uncaughtException', ...) — same idea but for
//      synchronous throws. Last line of defence.
//
// In production, Replit / hosting provider auto-restarts on crash so
// this is mostly a dev-quality-of-life fix. But it's also defence in
// depth — if a customer is mid-checkout when Neon hiccups, we want
// the request to error gracefully, not crash the server.

pool.on('error', (err: Error) => {
  console.error('[DB] pool error (handled):', err.message);
});

function isNeonWebSocketError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as any)?.message ?? err);
  const code = String((err as any)?.code ?? '');
  // The signatures we've actually seen kill the server:
  //   ETIMEDOUT  — WS read timeout (laptop sleep, network drop)
  //   ECONNRESET — connection forcibly closed
  //   EADDRNOTAVAIL — retry attempts during outage
  //   "Connection terminated unexpectedly" — driver-level message
  //   "read ETIMEDOUT" — WS read on a dead socket
  if (code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'EADDRNOTAVAIL') return true;
  if (msg.includes('Connection terminated unexpectedly')) return true;
  if (msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) return true;
  // The Neon driver's WebSocket errors come via @neondatabase/serverless
  // — if the stack mentions that path, treat as Neon noise.
  const stack = String((err as any)?.stack ?? '');
  if (stack.includes('@neondatabase/serverless')) return true;
  return false;
}

process.on('unhandledRejection', (reason: unknown) => {
  if (isNeonWebSocketError(reason)) {
    console.warn(
      '[DB] swallowed Neon WebSocket unhandledRejection:',
      String((reason as any)?.message ?? reason).slice(0, 200),
    );
    return;
  }
  // Not a known Neon noise pattern — log loudly so real bugs surface.
  console.error('[PROCESS] unhandledRejection:', reason);
});

process.on('uncaughtException', (err: Error) => {
  if (isNeonWebSocketError(err)) {
    console.warn(
      '[DB] swallowed Neon WebSocket uncaughtException:',
      err.message.slice(0, 200),
    );
    return;
  }
  // Not Neon noise — log + rethrow on next tick so the runtime can
  // exit cleanly. Don't fully suppress; that masks real bugs.
  console.error('[PROCESS] uncaughtException:', err);
  // In dev, keep the server alive so testing isn't interrupted by
  // unrelated bugs. In prod, let the host restart us cleanly.
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 100);
  }
});
