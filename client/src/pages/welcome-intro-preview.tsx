// client/src/pages/welcome-intro-preview.tsx
//
// PREVIEW-ONLY route (/welcome-intro) for reviewing the new-user welcome
// narrative before it's wired to trigger on first studio visit. Here,
// dismissing (Skip / "Make my first card") just replays it so you can
// watch repeatedly. Not linked anywhere; reachable by URL only.

import { useState } from 'react';
import { WelcomeIntro } from '@/components/studio/welcome-intro';

export default function WelcomeIntroPreview() {
  // Bump the key to remount → replay, so Skip/CTA restart the sequence
  // instead of leaving the page (handy for back-to-back viewing).
  const [runId, setRunId] = useState(0);
  return <WelcomeIntro key={runId} onDismiss={() => setRunId((n) => n + 1)} />;
}
