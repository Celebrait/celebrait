// client/src/pages/admin-prompts.tsx
//
// Prompt Lab admin UI — Phase 1 + 2 (live testing slice).
//
// Layout:
//   - Top tabs: slot picker (front_scene, inside)
//   - Row 1: [history col-3] [editor col-9]
//   - Row 2: [ (history continues) ] [test panel col-9 — form + result image]
//   - Row 3: [recent runs strip, full width]
//
// Key state shared between editor + test panel:
//   - `liveTemplateText` — whatever is currently in the editor, draft or not.
//     The test-run button uses this, NOT the saved DB text. So you can test
//     changes before saving.
//
// Recent runs are kept in component state only (not persisted); the strip
// resets on page reload. This is deliberate for the v2 slice — persistence
// becomes a Phase 3 follow-up once we know what's worth keeping.

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

// ─── Types (mirror server/routes/prompts.ts responses) ──────────────────────

interface PromptVariableDecl {
  name: string;
  type: 'string' | 'boolean';
  required: boolean;
  default?: string | boolean;
  description?: string;
}

interface PromptTemplate {
  id: number;
  slot: string;
  cardType: string | null;
  name: string;
  version: number;
  templateText: string;
  variables: PromptVariableDecl[];
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  isActive?: boolean;
}

interface SlotVersionsResponse {
  slot: string;
  activeTemplateId: number | null;
  versions: PromptTemplate[];
}

interface TestRunResult {
  imageUrl: string;
  renderedPrompt: string;
  costCents: number;
  costUsd: string;
  durationMs: number;
  quality: string;
  hadReferenceImage: boolean;
  provider: string;
  model: string;
}

interface RunRecord extends TestRunResult {
  id: string;                   // client-side uuid for React keys
  timestamp: number;
  label: string;                // short description shown under thumbnail
  templateVersion: number | string; // 'draft' if not saved
  inputs: FrontSceneInputs | InsideInputs;
}

interface ProviderInfo {
  id: string;
  displayName: string;
  model: string;
  available: boolean;
  qualityOptions: Array<{
    value: string;
    label: string;
    costDisplay: string;
  }>;
}

type SlotId = 'front_scene' | 'inside';

const SLOT_LABELS: Record<SlotId, string> = {
  front_scene: 'Front — Scene (photo)',
  inside: 'Inside card',
};

// ─── Main page component ─────────────────────────────────────────────────────

export default function AdminPromptsPage() {
  const [activeSlot, setActiveSlot] = useState<SlotId>('front_scene');

  return (
    <div className="p-6">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Prompt Lab</h1>
          <p className="text-sm text-gray-600 mt-1">
            Edit a prompt, test it against a real input, see the image. Every
            version is kept; the active pointer can be flipped atomically.
          </p>
        </header>

        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {(Object.keys(SLOT_LABELS) as SlotId[]).map((slot) => (
            <button
              key={slot}
              onClick={() => setActiveSlot(slot)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSlot === slot
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`tab-slot-${slot}`}
            >
              {SLOT_LABELS[slot]}
            </button>
          ))}
        </div>

        <SlotPanel slot={activeSlot} />
      </div>
    </div>
  );
}

// ─── Slot panel ──────────────────────────────────────────────────────────────

function SlotPanel({ slot }: { slot: SlotId }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Shared state between editor and test panel: the "live" template text.
  // In view mode this mirrors the saved template. In draft mode it holds
  // the user's edits. The test panel always uses this.
  const [liveTemplateText, setLiveTemplateText] = useState<string>('');
  const [isDraft, setIsDraft] = useState(false);

  // Recent runs. Keyed by slot so switching tabs preserves each slot's runs.
  const [runsBySlot, setRunsBySlot] = useState<Record<string, RunRecord[]>>({});
  const recentRuns = runsBySlot[slot] ?? [];

  const appendRun = (record: RunRecord) => {
    setRunsBySlot((prev) => ({
      ...prev,
      [slot]: [record, ...(prev[slot] ?? [])].slice(0, 8),
    }));
  };

  const { data, isLoading, error } = useQuery<SlotVersionsResponse>({
    queryKey: [`/api/admin/prompts/slot/${slot}`],
  });

  // Default to the active version on first load (per slot).
  useEffect(() => {
    if (data && selectedId === null) {
      setSelectedId(data.activeTemplateId ?? data.versions[0]?.id ?? null);
    }
  }, [data, selectedId]);

  // Reset selection when slot changes
  useEffect(() => {
    setSelectedId(null);
    setIsDraft(false);
  }, [slot]);

  // Sync liveTemplateText with the selected version whenever selection
  // changes or draft mode is toggled off.
  useEffect(() => {
    if (!data) return;
    const selected = data.versions.find((v) => v.id === selectedId);
    if (selected && !isDraft) {
      setLiveTemplateText(selected.templateText);
    }
  }, [selectedId, data, isDraft]);

  if (isLoading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (error) {
    return (
      <div className="p-8 text-red-600">
        Failed to load prompts: {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const selected = data.versions.find((v) => v.id === selectedId) ?? null;
  const active = data.versions.find((v) => v.id === data.activeTemplateId) ?? null;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Version history (left) */}
      <div className="col-span-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Version history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100 max-h-[75vh] overflow-y-auto">
              {data.versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedId(v.id);
                    setIsDraft(false);
                  }}
                  className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                    selectedId === v.id ? 'bg-purple-50 border-l-2 border-purple-600' : ''
                  }`}
                  data-testid={`version-${v.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      v{v.version}
                    </span>
                    {v.id === data.activeTemplateId && (
                      <Badge className="bg-green-100 text-green-700 text-[10px] h-5">
                        ACTIVE
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 truncate mt-0.5">{v.name}</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {new Date(v.createdAt).toLocaleDateString()} ·{' '}
                    {v.createdBy ?? 'unknown'}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editor + test panel (right) */}
      <div className="col-span-9 space-y-6">
        {selected ? (
          <>
            <VersionEditor
              slot={slot}
              selected={selected}
              active={active}
              liveText={liveTemplateText}
              isDraft={isDraft}
              onLiveTextChange={setLiveTemplateText}
              onDraftStart={() => setIsDraft(true)}
              onDraftCancel={() => {
                setIsDraft(false);
                setLiveTemplateText(selected.templateText);
              }}
              onSaved={(newId) => {
                queryClient.invalidateQueries({ queryKey: [`/api/admin/prompts/slot/${slot}`] });
                setSelectedId(newId);
                setIsDraft(false);
              }}
              onActivated={() => {
                queryClient.invalidateQueries({ queryKey: [`/api/admin/prompts/slot/${slot}`] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/prompts/slots'] });
              }}
            />

            <TestPanel
              slot={slot}
              liveTemplateText={liveTemplateText}
              templateVersionLabel={isDraft ? 'draft' : selected.version}
              onRunComplete={appendRun}
              frontRuns={runsBySlot['front_scene'] ?? []}
            />

            {recentRuns.length > 0 && (
              <RecentRunsStrip runs={recentRuns} />
            )}
          </>
        ) : (
          <div className="p-8 text-gray-500">Select a version to inspect.</div>
        )}
      </div>
    </div>
  );
}

// ─── Version editor ──────────────────────────────────────────────────────────

interface VersionEditorProps {
  slot: SlotId;
  selected: PromptTemplate;
  active: PromptTemplate | null;
  liveText: string;
  isDraft: boolean;
  onLiveTextChange: (text: string) => void;
  onDraftStart: () => void;
  onDraftCancel: () => void;
  onSaved: (newId: number) => void;
  onActivated: () => void;
}

function VersionEditor({
  slot,
  selected,
  active,
  liveText,
  isDraft,
  onLiveTextChange,
  onDraftStart,
  onDraftCancel,
  onSaved,
  onActivated,
}: VersionEditorProps) {
  const [draftName, setDraftName] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    setDraftName(`${selected.name} (edited)`);
    setDraftNotes('');
    setShowDiff(false);
  }, [selected.id]);

  const createDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/admin/prompts/slot/${slot}`, {
        name: draftName,
        templateText: liveText,
        variables: selected.variables,
        notes: draftNotes || null,
      });
      return res.json();
    },
    onSuccess: (newTemplate: PromptTemplate) => {
      toast({
        title: `Saved as v${newTemplate.version}`,
        description: 'New draft created — not active until you activate it.',
      });
      onSaved(newTemplate.id);
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/prompts/activate', {
        slot,
        templateId: selected.id,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Activated',
        description: `${SLOT_LABELS[slot]} is now serving v${selected.version}.`,
      });
      onActivated();
    },
    onError: (err: Error) => {
      toast({ title: 'Activate failed', description: err.message, variant: 'destructive' });
    },
  });

  const isActive = selected.id === active?.id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span>
              {selected.name} <span className="text-gray-400">· v{selected.version}</span>
            </span>
            {isActive && <Badge className="bg-green-100 text-green-700">ACTIVE</Badge>}
            {isDraft && (
              <Badge className="bg-amber-100 text-amber-800">DRAFT (unsaved)</Badge>
            )}
          </CardTitle>
          {selected.notes && (
            <p className="text-xs text-gray-600 mt-1">{selected.notes}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">
            Created {new Date(selected.createdAt).toLocaleString()} by{' '}
            {selected.createdBy ?? 'unknown'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {!isDraft ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onDraftStart}
                data-testid="btn-duplicate"
              >
                Duplicate & edit
              </Button>
              {active && active.id !== selected.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiff(!showDiff)}
                  data-testid="btn-diff"
                >
                  {showDiff ? 'Hide diff' : 'Diff vs active'}
                </Button>
              )}
              {!isActive && (
                <Button
                  size="sm"
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending}
                  data-testid="btn-activate"
                >
                  {activateMutation.isPending ? 'Activating…' : 'Activate this version'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onDraftCancel}
                data-testid="btn-cancel-draft"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createDraftMutation.mutate()}
                disabled={createDraftMutation.isPending}
                data-testid="btn-save-draft"
              >
                {createDraftMutation.isPending ? 'Saving…' : 'Save as new version'}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isDraft && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-draft-name"
              />
            </div>
            <div>
              <Label className="text-xs">Notes (what changed?)</Label>
              <Input
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="e.g. softened facial recreation language"
                className="h-8 text-sm"
                data-testid="input-draft-notes"
              />
            </div>
          </div>
        )}

        {showDiff && active ? (
          <DiffView left={active.templateText} right={liveText} />
        ) : (
          <Textarea
            value={liveText}
            onChange={(e) => onLiveTextChange(e.target.value)}
            readOnly={!isDraft}
            className="font-mono text-xs min-h-[400px] leading-relaxed"
            data-testid="textarea-template"
          />
        )}

        {selected.variables && selected.variables.length > 0 && (
          <div>
            <Label className="text-xs font-semibold">Variables</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {selected.variables.map((v) => (
                <code
                  key={v.name}
                  className="text-[11px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200"
                  title={v.description}
                >
                  {'{{'}
                  {v.name}
                  {'}}'}
                  <span className="text-gray-400 ml-1">:{v.type}</span>
                </code>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Test panel: form + run button + result ─────────────────────────────────

interface PhotoEntry {
  base64: string;
  name: string;
}

interface FrontSceneInputs {
  scenePrompt: string;
  userArtStyle: string;
  userClothing: string;
  cardText: string;
  includeText: boolean;
  photos: PhotoEntry[];
}

interface InsideInputs {
  insideText: string;
  artStyle: string;
  dear: string;
  message: string;
  from: string;
  // Front-card reference image, used by OpenAI /v1/images/edits so the
  // inside card inherits style/palette from an already-generated front.
  // Mirrors background-generator.ts in production. Populated either by
  // picking a recent front_scene run or by uploading a PNG manually.
  referenceImageBase64: string | null;
  referenceLabel: string | null;
}

const DEFAULT_FRONT_INPUTS: FrontSceneInputs = {
  scenePrompt: 'Sarah on a beach at sunset, looking joyful',
  userArtStyle: 'watercolor painting',
  userClothing: '',
  cardText: 'Happy Birthday Sarah',
  includeText: true,
  photos: [],
};

const DEFAULT_INSIDE_INPUTS: InsideInputs = {
  insideText: 'Dear Sarah, wishing you all the joy in the world today. Love, Mum',
  artStyle: 'watercolor painting',
  dear: 'Dear Sarah',
  message: 'wishing you all the joy in the world today',
  from: 'Love, Mum',
  referenceImageBase64: null,
  referenceLabel: null,
};

interface TestPanelProps {
  slot: SlotId;
  liveTemplateText: string;
  templateVersionLabel: number | string;
  onRunComplete: (run: RunRecord) => void;
  /** Recent front_scene runs in this session — used by the inside tab's
   *  reference image picker so inside tests mirror production, where the
   *  inside card is generated from a front card PNG via /v1/images/edits. */
  frontRuns: RunRecord[];
}

function TestPanel({
  slot,
  liveTemplateText,
  templateVersionLabel,
  onRunComplete,
  frontRuns,
}: TestPanelProps) {
  const [frontInputs, setFrontInputs] = useState<FrontSceneInputs>(DEFAULT_FRONT_INPUTS);
  const [insideInputs, setInsideInputs] = useState<InsideInputs>(DEFAULT_INSIDE_INPUTS);
  const [selectedProvider, setSelectedProvider] = useState<string>('openai');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('low');
  const [lastResult, setLastResult] = useState<TestRunResult | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState(false);

  // Fetch available providers from the server.
  const { data: providersData } = useQuery<{ providers: ProviderInfo[] }>({
    queryKey: ['/api/admin/prompts/providers'],
  });
  const providers = providersData?.providers ?? [];
  const currentProvider = providers.find((p) => p.id === selectedProvider);

  // When provider changes, reset quality to the first available option
  // for that provider (e.g. Gemini only has 'high'/Standard).
  useEffect(() => {
    if (currentProvider?.qualityOptions.length) {
      const firstQuality = currentProvider.qualityOptions[0].value as 'low' | 'medium' | 'high';
      setQuality(firstQuality);
    }
  }, [selectedProvider, currentProvider?.id]);

  // Auto-select the most recent front run as the inside reference whenever
  // this component mounts (or remounts — e.g. after switching tabs) with
  // nothing selected but with front runs available.
  useEffect(() => {
    if (
      slot === 'inside' &&
      !insideInputs.referenceImageBase64 &&
      frontRuns.length > 0
    ) {
      const latest = frontRuns[0];
      setInsideInputs((prev) => ({
        ...prev,
        referenceImageBase64: latest.imageUrl,
        referenceLabel: `From recent run: ${latest.label}`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, frontRuns.length]);

  // Get cost display for the current provider + quality combination.
  const currentCostDisplay =
    currentProvider?.qualityOptions.find((o) => o.value === quality)?.costDisplay ??
    '$0.009';

  const runMutation = useMutation({
    mutationFn: async () => {
      const inputs =
        slot === 'front_scene'
          ? {
              scenePrompt: frontInputs.scenePrompt,
              userArtStyle: frontInputs.userArtStyle,
              userClothing: frontInputs.userClothing,
              cardText: frontInputs.cardText,
              includeText: frontInputs.includeText,
            }
          : {
              insideText: insideInputs.insideText,
              artStyle: insideInputs.artStyle,
              structuredData: {
                dear: insideInputs.dear || null,
                message: insideInputs.message || null,
                from: insideInputs.from || null,
              },
            };

      const body: any = {
        slot,
        templateText: liveTemplateText,
        inputs,
        quality,
        provider: selectedProvider,
      };
      if (slot === 'front_scene' && frontInputs.photos.length > 0) {
        // First photo is the primary reference; extras are additional
        // references (Gemini uses all, OpenAI uses only the first).
        body.photoBase64 = frontInputs.photos[0].base64;
        if (frontInputs.photos.length > 1) {
          body.additionalPhotos = frontInputs.photos.slice(1).map((p) => p.base64);
        }
      }
      if (slot === 'inside' && insideInputs.referenceImageBase64) {
        body.referenceImageBase64 = insideInputs.referenceImageBase64;
      }

      console.log('[PROMPT_LAB_TEST] POST body (truncated):', {
        slot: body.slot,
        provider: body.provider,
        quality: body.quality,
        templateLen: body.templateText?.length,
        photoCount: frontInputs.photos.length,
        hasReferenceImage: !!body.referenceImageBase64,
      });

      const res = await apiRequest('POST', '/api/admin/prompts/test-run', body);
      return res.json() as Promise<TestRunResult>;
    },
    onSuccess: (result) => {
      setLastResult(result);
      setExpandedPrompt(false);
      const label =
        slot === 'front_scene'
          ? frontInputs.scenePrompt.slice(0, 50)
          : insideInputs.insideText.slice(0, 50);
      onRunComplete({
        ...result,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        label,
        templateVersion: templateVersionLabel,
        inputs: slot === 'front_scene' ? frontInputs : insideInputs,
      });
      toast({
        title: 'Run complete',
        description: `${result.provider} · ${result.costUsd} · ${(result.durationMs / 1000).toFixed(1)}s`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Run failed', description: err.message, variant: 'destructive' });
    },
  });

  const handlePhotosAdd = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setFrontInputs((prev) => ({
          ...prev,
          photos: [
            ...prev.photos,
            { base64: reader.result as string, name: file.name },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoRemove = (index: number) => {
    setFrontInputs((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Test this prompt</span>
          <span className="text-xs text-gray-500 font-normal">
            Running against:{' '}
            <code className="bg-gray-100 px-1 rounded">
              {typeof templateVersionLabel === 'number'
                ? `v${templateVersionLabel}`
                : templateVersionLabel}
            </code>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Inputs (left half) */}
          <div className="space-y-3">
            {slot === 'front_scene' ? (
              <FrontInputsForm
                inputs={frontInputs}
                onChange={setFrontInputs}
                onPhotosAdd={handlePhotosAdd}
                onPhotoRemove={handlePhotoRemove}
                selectedProvider={selectedProvider}
              />
            ) : (
              <InsideInputsForm
                inputs={insideInputs}
                onChange={setInsideInputs}
                frontRuns={frontRuns}
              />
            )}

            <div className="pt-3 border-t border-gray-100 space-y-3">
              {/* Provider selector */}
              <div>
                <Label className="text-xs">Provider</Label>
                <div className="flex gap-2 mt-1">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => p.available && setSelectedProvider(p.id)}
                      disabled={!p.available}
                      className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${
                        selectedProvider === p.id
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : p.available
                            ? 'border-gray-200 hover:bg-gray-50'
                            : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                      data-testid={`provider-${p.id}`}
                    >
                      <div className="font-semibold truncate">{p.displayName}</div>
                      {!p.available && (
                        <div className="text-[9px] text-gray-400">No API key</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality selector (adapts per provider) */}
              {currentProvider && currentProvider.qualityOptions.length > 1 && (
                <div>
                  <Label className="text-xs">Quality</Label>
                  <div className="flex gap-2 mt-1">
                    {currentProvider.qualityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setQuality(opt.value as any)}
                        className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${
                          quality === opt.value
                            ? 'border-purple-600 bg-purple-50 text-purple-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        data-testid={`quality-${opt.value}`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className="text-[10px] text-gray-500">{opt.costDisplay}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const insideNeedsReference =
                  slot === 'inside' && !insideInputs.referenceImageBase64;
                const providerUnavailable = currentProvider && !currentProvider.available;
                const isDisabled =
                  runMutation.isPending ||
                  !liveTemplateText ||
                  insideNeedsReference ||
                  !!providerUnavailable;
                return (
                  <>
                    <Button
                      onClick={() => runMutation.mutate()}
                      disabled={isDisabled}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      data-testid="btn-run-test"
                    >
                      {runMutation.isPending
                        ? `Generating… (up to 30s)`
                        : insideNeedsReference
                          ? 'Pick a front reference above to run'
                          : providerUnavailable
                            ? `${currentProvider?.displayName} — no API key`
                            : `Run · ${currentCostDisplay}`}
                    </Button>
                    {runMutation.isPending && (
                      <p className="text-[11px] text-gray-500 text-center">
                        Calling {currentProvider?.displayName ?? 'provider'} — real cost, real image.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Result (right half) */}
          <div>
            {runMutation.isPending ? (
              <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 rounded flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                  <p className="text-xs text-gray-500 mt-3">Generating…</p>
                </div>
              </div>
            ) : lastResult ? (
              <div className="space-y-2">
                <img
                  src={lastResult.imageUrl}
                  alt="Test run result"
                  className="w-full rounded border border-gray-200"
                  data-testid="test-result-image"
                />
                <div className="flex items-center justify-between text-[11px] text-gray-600">
                  <span>
                    {lastResult.provider} · {lastResult.costUsd} · {(lastResult.durationMs / 1000).toFixed(1)}s ·{' '}
                    {lastResult.quality}
                  </span>
                  <button
                    onClick={() => setExpandedPrompt(!expandedPrompt)}
                    className="text-purple-700 hover:underline"
                  >
                    {expandedPrompt ? 'Hide prompt' : 'View rendered prompt'}
                  </button>
                </div>
                {expandedPrompt && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-2 max-h-64 overflow-y-auto">
                    <pre className="text-[10px] whitespace-pre-wrap font-mono text-gray-700">
                      {lastResult.renderedPrompt}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 rounded flex items-center justify-center">
                <div className="text-center text-gray-400 text-sm">
                  <p>Fill in inputs on the left</p>
                  <p>and click Run.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Inputs sub-forms ────────────────────────────────────────────────────────

function FrontInputsForm({
  inputs,
  onChange,
  onPhotosAdd,
  onPhotoRemove,
  selectedProvider,
}: {
  inputs: FrontSceneInputs;
  onChange: (next: FrontSceneInputs) => void;
  onPhotosAdd: (files: FileList | null) => void;
  onPhotoRemove: (index: number) => void;
  selectedProvider: string;
}) {
  const update = <K extends keyof FrontSceneInputs>(key: K, value: FrontSceneInputs[K]) =>
    onChange({ ...inputs, [key]: value });

  const isGemini = selectedProvider === 'gemini';
  const maxPhotos = isGemini ? 5 : 1;

  return (
    <>
      <div>
        <Label className="text-xs">Scene prompt *</Label>
        <Textarea
          value={inputs.scenePrompt}
          onChange={(e) => update('scenePrompt', e.target.value)}
          className="text-xs min-h-[60px]"
          data-testid="input-scene-prompt"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Art style</Label>
          <Input
            value={inputs.userArtStyle}
            onChange={(e) => update('userArtStyle', e.target.value)}
            placeholder="watercolor, oil, …"
            className="h-8 text-xs"
            data-testid="input-art-style"
          />
        </div>
        <div>
          <Label className="text-xs">Clothing</Label>
          <Input
            value={inputs.userClothing}
            onChange={(e) => update('userClothing', e.target.value)}
            placeholder="optional"
            className="h-8 text-xs"
            data-testid="input-clothing"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Card text (what appears on the card)</Label>
        <Input
          value={inputs.cardText}
          onChange={(e) => update('cardText', e.target.value)}
          className="h-8 text-xs"
          data-testid="input-card-text"
        />
        <label className="flex items-center gap-2 mt-1 text-[11px] text-gray-600">
          <input
            type="checkbox"
            checked={inputs.includeText}
            onChange={(e) => update('includeText', e.target.checked)}
          />
          Include text in the image
        </label>
      </div>
      <div>
        <Label className="text-xs flex items-center justify-between">
          <span>
            Reference photos{' '}
            {isGemini ? `(up to ${maxPhotos} — more = better likeness)` : '(1 max)'}
          </span>
          {inputs.photos.length > 0 && (
            <button
              onClick={() => onChange({ ...inputs, photos: [] })}
              className="text-[10px] text-red-600 hover:underline"
            >
              clear all
            </button>
          )}
        </Label>

        {/* Thumbnails of uploaded photos */}
        {inputs.photos.length > 0 && (
          <div className="flex gap-2 mt-1 flex-wrap">
            {inputs.photos.map((photo, i) => (
              <div key={i} className="relative group">
                <img
                  src={photo.base64}
                  alt={photo.name}
                  className="w-14 h-14 rounded border border-gray-200 object-cover"
                />
                <button
                  onClick={() => onPhotoRemove(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  ×
                </button>
                <div className="text-[8px] text-gray-500 text-center truncate w-14 mt-0.5">
                  {i === 0 ? 'Primary' : `Extra ${i}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {inputs.photos.length < maxPhotos && (
          <input
            type="file"
            accept="image/*"
            multiple={isGemini}
            onChange={(e) => onPhotosAdd(e.target.files)}
            className="text-xs mt-1 block w-full"
            data-testid="input-photo"
          />
        )}

        <p className="text-[10px] text-gray-400 mt-1">
          {isGemini
            ? 'Gemini uses ALL photos for identity. Add front, 3/4, and smile for best likeness.'
            : 'OpenAI uses 1 photo only. Extra photos are ignored.'}
        </p>
      </div>
    </>
  );
}

function InsideInputsForm({
  inputs,
  onChange,
  frontRuns,
}: {
  inputs: InsideInputs;
  onChange: (next: InsideInputs) => void;
  frontRuns: RunRecord[];
}) {
  const update = <K extends keyof InsideInputs>(key: K, value: InsideInputs[K]) =>
    onChange({ ...inputs, [key]: value });

  const handleUpload = (file: File | null) => {
    if (!file) {
      update('referenceImageBase64', null);
      update('referenceLabel', null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        ...inputs,
        referenceImageBase64: reader.result as string,
        referenceLabel: `Uploaded: ${file.name}`,
      });
    };
    reader.readAsDataURL(file);
  };

  const pickRecent = (run: RunRecord) => {
    onChange({
      ...inputs,
      referenceImageBase64: run.imageUrl,
      referenceLabel: `From recent run: ${run.label}`,
    });
  };

  return (
    <>
      <div>
        <Label className="text-xs">Full inside text *</Label>
        <Textarea
          value={inputs.insideText}
          onChange={(e) => update('insideText', e.target.value)}
          className="text-xs min-h-[60px]"
          data-testid="input-inside-text"
        />
      </div>
      <div>
        <Label className="text-xs">Art style</Label>
        <Input
          value={inputs.artStyle}
          onChange={(e) => update('artStyle', e.target.value)}
          placeholder="inherits from front if blank"
          className="h-8 text-xs"
          data-testid="input-inside-art-style"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px]">Dear (top)</Label>
          <Input
            value={inputs.dear}
            onChange={(e) => update('dear', e.target.value)}
            className="h-7 text-xs"
            data-testid="input-dear"
          />
        </div>
        <div>
          <Label className="text-[10px]">Message</Label>
          <Input
            value={inputs.message}
            onChange={(e) => update('message', e.target.value)}
            className="h-7 text-xs"
            data-testid="input-message"
          />
        </div>
        <div>
          <Label className="text-[10px]">From (bottom)</Label>
          <Input
            value={inputs.from}
            onChange={(e) => update('from', e.target.value)}
            className="h-7 text-xs"
            data-testid="input-from"
          />
        </div>
      </div>

      {/* ─── Front card reference picker ─── */}
      <div className="border-t border-gray-100 pt-3">
        <Label className="text-xs flex items-center justify-between">
          <span>Front card reference</span>
          {inputs.referenceImageBase64 && (
            <button
              onClick={() => {
                update('referenceImageBase64', null);
                update('referenceLabel', null);
              }}
              className="text-[10px] text-red-600 hover:underline"
            >
              clear
            </button>
          )}
        </Label>

        {inputs.referenceImageBase64 ? (
          <div className="flex items-center gap-2 mt-1 p-2 rounded bg-purple-50 border border-purple-200">
            <img
              src={inputs.referenceImageBase64}
              alt="Reference"
              className="w-12 h-12 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-purple-900 truncate">
                {inputs.referenceLabel}
              </div>
              <div className="text-[10px] text-purple-600">
                Inside will inherit this card's style via /v1/images/edits
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            {frontRuns.length > 0 ? (
              <>
                <div className="text-[10px] text-gray-500">
                  Pick from recent front runs in this session:
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {frontRuns.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => pickRecent(run)}
                      className="flex-shrink-0 w-16 h-16 rounded border border-gray-200 hover:border-purple-500 overflow-hidden"
                      title={run.label}
                      data-testid={`pick-front-run-${run.id}`}
                    >
                      <img
                        src={run.imageUrl}
                        alt={run.label}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-[10px] text-gray-500">
                No recent front runs yet — generate one on the Front tab first,
                or upload a PNG below.
              </div>
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                className="text-[11px] block w-full"
                data-testid="input-inside-reference-upload"
              />
            </div>
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
              ⚠ Without a reference image, the inside card will NOT inherit
              style the way it does in production. Results will be misleading.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Recent runs strip ───────────────────────────────────────────────────────

function RecentRunsStrip({ runs }: { runs: RunRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expanded = runs.find((r) => r.id === expandedId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent runs ({runs.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
              className={`flex-shrink-0 w-32 text-left rounded border-2 transition-all ${
                expandedId === run.id
                  ? 'border-purple-600 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid={`recent-run-${run.id}`}
            >
              <img
                src={run.imageUrl}
                alt={run.label}
                className="w-full h-32 object-cover rounded-t"
              />
              <div className="p-1.5">
                <div className="text-[10px] font-medium truncate">{run.label}</div>
                <div className="text-[9px] text-gray-500 flex items-center justify-between">
                  <span>{run.provider}</span>
                  <span>{run.costUsd}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
            <img
              src={expanded.imageUrl}
              alt={expanded.label}
              className="w-full rounded border border-gray-200"
            />
            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                {expanded.provider} · v{expanded.templateVersion} · {expanded.quality} · {expanded.costUsd} ·{' '}
                {(expanded.durationMs / 1000).toFixed(1)}s ·{' '}
                {new Date(expanded.timestamp).toLocaleTimeString()}
              </div>
              <div>
                <Label className="text-[10px] font-semibold">Inputs</Label>
                <pre className="text-[10px] bg-gray-50 border border-gray-200 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(
                    { ...expanded.inputs, photoBase64: undefined },
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <Label className="text-[10px] font-semibold">Rendered prompt</Label>
                <pre className="text-[10px] bg-gray-50 border border-gray-200 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                  {expanded.renderedPrompt}
                </pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Minimal line-based diff view ────────────────────────────────────────────

function DiffView({ left, right }: { left: string; right: string }) {
  const { lhs, rhs } = useMemo(() => buildLineDiff(left, right), [left, right]);
  return (
    <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded font-mono text-[11px]">
      <div className="p-2 bg-red-50/30">
        <div className="text-xs font-semibold text-red-700 mb-1">Active</div>
        {lhs.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap ${line.removed ? 'bg-red-100' : ''}`}
          >
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
      <div className="p-2 bg-green-50/30">
        <div className="text-xs font-semibold text-green-700 mb-1">Selected</div>
        {rhs.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap ${line.added ? 'bg-green-100' : ''}`}
          >
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DiffLine {
  text: string;
  added?: boolean;
  removed?: boolean;
}

function buildLineDiff(
  leftText: string,
  rightText: string,
): { lhs: DiffLine[]; rhs: DiffLine[] } {
  const a = leftText.split('\n');
  const b = rightText.split('\n');
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lhs: DiffLine[] = [];
  const rhs: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lhs.unshift({ text: a[i - 1] });
      rhs.unshift({ text: b[j - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      lhs.unshift({ text: a[i - 1], removed: true });
      rhs.unshift({ text: '' });
      i--;
    } else {
      lhs.unshift({ text: '' });
      rhs.unshift({ text: b[j - 1], added: true });
      j--;
    }
  }
  while (i > 0) {
    lhs.unshift({ text: a[i - 1], removed: true });
    rhs.unshift({ text: '' });
    i--;
  }
  while (j > 0) {
    lhs.unshift({ text: '' });
    rhs.unshift({ text: b[j - 1], added: true });
    j--;
  }
  return { lhs, rhs };
}
