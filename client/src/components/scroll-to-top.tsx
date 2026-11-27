import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "wouter";

// Scroll to the element `#hash` names once it exists. wouter ignores
// hashes and lazy routes mount after the URL changes, so poll on rAF
// (≤ ~2.5s) instead of scrolling once into an empty page. Returns false
// when there is no hash so the caller can reset to the top instead.
//
// Once found, the target is held in place for a short grace window:
// async content above it (the gate's rack carousel lands ~700ms in)
// otherwise shoves it 260px down after we've scrolled. Any user scroll
// ends the hold immediately.
const PIN_MS = 1500;
let pinUntil = 0;
function scrollToHash(): boolean {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return false;
  let tries = 0;
  const find = () => {
    const el = document.getElementById(id);
    if (!el) {
      if (++tries < 150) requestAnimationFrame(find);
      return;
    }
    el.scrollIntoView({ block: "start" });
    const want = el.getBoundingClientRect().top;
    pinUntil = performance.now() + PIN_MS;
    const stop = () => { pinUntil = 0; };
    const stopEvents = ["wheel", "touchstart", "keydown"];
    stopEvents.forEach((e) => window.addEventListener(e, stop, { passive: true, once: true }));
    const hold = () => {
      if (performance.now() > pinUntil) {
        stopEvents.forEach((e) => window.removeEventListener(e, stop));
        return;
      }
      if (Math.abs(el.getBoundingClientRect().top - want) > 2) el.scrollIntoView({ block: "start" });
      requestAnimationFrame(hold);
    };
    requestAnimationFrame(hold);
  };
  find();
  return true;
}

export default function ScrollToTop() {
  const [location] = useLocation();

  // useLayoutEffect (not useEffect) so the scroll reset happens
  // SYNCHRONOUSLY between the DOM mutation and the browser paint.
  // With useEffect the new page would briefly paint at the previous
  // scroll position before snapping — visible as a "header swooping
  // in" glitch when navigating from a scrolled-down list page (e.g.
  // /studio/ready) into a card detail. Kevin caught this 2026-04-27.
  useLayoutEffect(() => {
    if (scrollToHash()) return;
    // Instantly position at top — `auto` (default) is a hard jump,
    // not a smooth scroll. Setting both window + documentElement +
    // body covers Chrome/Safari/Firefox's slightly different scroll
    // root models.
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);

  // Same-path hash links (footer "FAQ" while on /photo, "Pick your
  // route" on /) don't change wouter's location, so listen to the
  // history events wouter dispatches (it patches push/replaceState).
  useEffect(() => {
    const onNav = () => void scrollToHash();
    const events = ["pushState", "replaceState", "hashchange"];
    events.forEach((e) => window.addEventListener(e, onNav));
    return () => events.forEach((e) => window.removeEventListener(e, onNav));
  }, []);

  return null;
}
