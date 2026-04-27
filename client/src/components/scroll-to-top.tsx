import { useLayoutEffect } from "react";
import { useLocation } from "wouter";

export default function ScrollToTop() {
  const [location] = useLocation();

  // useLayoutEffect (not useEffect) so the scroll reset happens
  // SYNCHRONOUSLY between the DOM mutation and the browser paint.
  // With useEffect the new page would briefly paint at the previous
  // scroll position before snapping — visible as a "header swooping
  // in" glitch when navigating from a scrolled-down list page (e.g.
  // /studio/ready) into a card detail. Kevin caught this 2026-04-27.
  useLayoutEffect(() => {
    // Instantly position at top — `auto` (default) is a hard jump,
    // not a smooth scroll. Setting both window + documentElement +
    // body covers Chrome/Safari/Firefox's slightly different scroll
    // root models.
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);

  return null;
}