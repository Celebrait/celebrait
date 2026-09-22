// client/src/pages/demo-loop.tsx — THE HOME PAGE'S LOOPING DEMO
//
// Public, no chrome: plays the demo run an admin featured (Demo runs →
// "Feature on the home page") from its saved cards, so it costs nothing
// to run and never fails live. It plays itself, restarts a beat after
// "It's on the way", and ignores the pointer — it's a window, not a
// control (Aidan 2026-09-21: the home page needs the product on screen,
// not two boxes).

import { useEffect, useState } from 'react';
import { DEMO_PRESETS, DemoRun, configFromRun, toReplay, type DemoConfig } from '@/pages/demo';

const RESTART_MS = 2600;

export default function DemoLoopPage() {
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  const [take, setTake] = useState(0);

  useEffect(() => {
    let off = false;
    fetch('/api/demo-runs/featured', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (off || !j?.run) return;
        const base: DemoConfig = { ...DEMO_PRESETS['mum-70-garden'], speed: 'fast', hook: true, countdown: 0, mode: 'auto', waits: 'short', frame: 'full', timer: true };
        setCfg(configFromRun(toReplay(j.run), base, 'full'));
      })
      .catch(() => undefined);
    return () => { off = true; };
  }, []);

  // Round again once it lands.
  useEffect(() => {
    if (!cfg) return;
    let stop = 0;
    const t = window.setInterval(() => {
      const state = window.__demo?.state;
      if ((state === 'end' || state === 'failed') && !stop) {
        stop = window.setTimeout(() => setTake((n) => n + 1), RESTART_MS);
      }
    }, 400);
    return () => { window.clearInterval(t); window.clearTimeout(stop); };
  }, [cfg, take]);

  if (!cfg) return <div className="fixed inset-0 bg-keeper-paper" />;
  return (
    <div className="pointer-events-none fixed inset-0">
      <DemoRun key={take} cfg={cfg} embedded />
    </div>
  );
}
