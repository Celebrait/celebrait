// client/src/pages/admin-photo-lab.tsx
//
// Photo Lab — drop a photo in, see exactly what the studio sees.
//
// The point is a fast feedback loop on the question "would this photo
// make a good card?", without building a card to find out. It calls the
// same vision pass the real upload path calls, so what you read here is
// what the studio read.
//
// Deliberately a bench instrument: nothing is saved, no card is made.

import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface LabResult {
  file: {
    mimeType: string;
    bytes: number;
    width: number | null;
    height: number | null;
    shorterSide: number | null;
    wouldUpscale: boolean | null;
  };
  sharpness: number | null;
  vision: {
    noApiKey: boolean;
    personCount: number | null;
    visualSummary: string | null;
    parsed: boolean;
    raw?: string;
    model: string;
    durationMs: number;
    promptTokens: number;
    outputTokens: number;
  };
}

// Blur thresholds. Calibrated by eye against real uploads rather than
// derived — the Laplacian score has no absolute meaning, only relative.
// Treat these as a starting point to tune once there's a body of photos
// through the lab, not as physics.
const SHARP_SOFT = 8;
const SHARP_OK = 14;

export default function AdminPhotoLabPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<LabResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const analyse = useCallback(async (dataUrl: string) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/photo-lab/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Failed');
      setResult((await res.json()) as LabResult);
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        setPreview(url);
        void analyse(url);
      };
      reader.readAsDataURL(file);
    },
    [analyse],
  );

  return (
    <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-stone-900">Photo Lab</h1>
        <p className="mt-1 text-sm text-stone-500">
          Drop a photo in to see exactly what the studio sees. Same vision pass as a real
          upload. Nothing is saved and no card is made.
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className="mt-5 cursor-pointer rounded-xl border-2 border-dashed border-stone-300 bg-white p-8 text-center hover:border-violet-400"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Upload className="mx-auto h-6 w-6 text-stone-400" />
          <p className="mt-2 text-sm text-stone-600">
            Drop a photo here, or click to choose one
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {preview && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <img
                src={preview}
                alt="Photo under test"
                className="w-full rounded-lg border border-stone-200"
              />
            </div>

            <div>
              {busy && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
                </div>
              )}

              {result && (
                <div className="space-y-4 text-sm">
                  <Section title="Source">
                    <Metric
                      label="Dimensions"
                      value={
                        result.file.width && result.file.height
                          ? `${result.file.width}×${result.file.height}`
                          : '—'
                      }
                    />
                    <Metric label="Size" value={`${Math.round(result.file.bytes / 1024)} KB`} />
                    {result.file.wouldUpscale != null && (
                      <Verdict
                        bad={result.file.wouldUpscale}
                        good="Enough resolution — no upscaling needed"
                        badText={`Shorter side ${result.file.shorterSide}px — the provider works at 1024, so this gets upscaled and detail is invented`}
                      />
                    )}
                  </Section>

                  <Section title="Sharpness">
                    <Metric
                      label="Score"
                      value={result.sharpness == null ? '—' : String(result.sharpness)}
                    />
                    {result.sharpness != null && (
                      <Verdict
                        bad={result.sharpness < SHARP_SOFT}
                        good={
                          result.sharpness >= SHARP_OK
                            ? 'Crisp'
                            : 'Acceptable, but not crisp'
                        }
                        badText="Soft or motion-blurred — likely a video still or a moving subject"
                      />
                    )}
                    <p className="text-[11px] text-stone-400">
                      Relative measure only. A shallow depth-of-field portrait scores low and is
                      still a great source — read it next to the photo, not instead of it.
                    </p>
                  </Section>

                  <Section title="Vision pass">
                    {result.vision.noApiKey ? (
                      <p className="text-amber-700">
                        GEMINI_API_KEY not set in this environment — vision skipped.
                      </p>
                    ) : result.vision.parsed ? (
                      <>
                        <Metric
                          label="People seen"
                          value={
                            result.vision.personCount === 3
                              ? '3+'
                              : String(result.vision.personCount ?? '—')
                          }
                        />
                        <p className="rounded bg-stone-50 p-2 italic leading-snug text-stone-700">
                          {result.vision.visualSummary}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          {result.vision.model} · {result.vision.durationMs}ms ·{' '}
                          {result.vision.promptTokens}+{result.vision.outputTokens} tokens
                        </p>
                      </>
                    ) : (
                      <div className="text-amber-700">
                        <p>Model output didn’t parse as JSON.</p>
                        {result.vision.raw && (
                          <pre className="mt-1 overflow-x-auto rounded bg-stone-50 p-2 text-[11px] text-stone-600">
                            {result.vision.raw}
                          </pre>
                        )}
                      </div>
                    )}
                  </Section>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        {title}
      </h2>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-800">{value}</span>
    </div>
  );
}

function Verdict({ bad, good, badText }: { bad: boolean; good: string; badText: string }) {
  return (
    <p
      className={`flex items-start gap-1.5 text-[12px] ${
        bad ? 'text-amber-700' : 'text-emerald-700'
      }`}
    >
      {bad ? (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span>{bad ? badText : good}</span>
    </p>
  );
}
