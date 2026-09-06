import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { captureFirstTouch } from "@/lib/attribution";
import { isStaleChunkError, recoverFromStaleChunk } from "@/lib/stale-chunk";

// Remember where this visitor first came from (UTM/referrer) BEFORE the
// router mounts and any redirect can strip the query string.
captureFirstTouch();

// STALE CHUNK RECOVERY (2026-08-04). The app code-splits into ~80
// hash-named chunks. Every deploy replaces them, so a browser holding an
// older page that then navigates to a lazy route requests a file that no
// longer exists → the dynamic import rejects → React unmounts into the
// error boundary ("Something went wrong", fine after a reload). Aidan hit
// this on /studio/new-card during a heavy deploy day; it almost certainly
// explains the earlier customer report at the pay step too.
//
// Vite fires `vite:preloadError` for exactly this. Reload once (guarded
// so a genuinely broken deploy can't loop) and the user lands on the new
// bundle without ever seeing a crash.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromStaleChunk("vite:preloadError");
});

// Belt and braces: an unhandled rejection from a dynamic import that
// didn't route through Vite's event.
window.addEventListener("unhandledrejection", (event) => {
  if (isStaleChunkError(event.reason)) {
    event.preventDefault();
    recoverFromStaleChunk("unhandledrejection");
  }
});

createRoot(document.getElementById("root")!).render(<App />);
