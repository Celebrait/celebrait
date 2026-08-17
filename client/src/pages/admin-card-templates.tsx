// client/src/pages/admin-card-templates.tsx
//
// THE CATALOGUE — everything Aidan has saved from the Lab, the seed of
// each occasion world's rack (SCOPE_OCCASION_FIRST WS4). Curation
// happens here: browse, filter by occasion, bin the ones that haven't
// aged well. When an occasion world ships, its public rack reads from
// exactly this data — so pruning here IS merchandising.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Template {
  id: number;
  occasion: string;
  angle?: string | null;
  recipient?: string | null;
  interest?: string | null;
  front_text: string;
  typeface?: string | null;
  format?: string | null;
  imageUrl: string;
  created_at: string;
}

export default function AdminCardTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = () => {
    apiRequest('GET', '/api/admin/card-templates')
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates ?? []))
      .catch((e) => toast({ title: 'Could not load the catalogue', description: e?.message ?? '', variant: 'destructive' }));
  };
  useEffect(load, []);

  const occasions = useMemo(
    () => ['all', ...Array.from(new Set((templates ?? []).map((t) => t.occasion)))],
    [templates],
  );
  const shown = (templates ?? []).filter((t) => filter === 'all' || t.occasion === filter);

  const remove = async (t: Template) => {
    // Curation needs to be fast, but a template is founder-taste that
    // can't be regenerated identically — one confirm, no undo theatre.
    if (!window.confirm(`Bin “${t.front_text}”? This can't be undone.`)) return;
    try {
      await apiRequest('DELETE', `/api/admin/card-templates/${t.id}`);
      setTemplates((prev) => (prev ?? []).filter((x) => x.id !== t.id));
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? '', variant: 'destructive' });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Catalogue</h1>
        <p className="text-sm text-stone-500">
          Every card you've saved from the Lab. This seeds each occasion's public rack — pruning here is merchandising.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {occasions.map((o) => (
          <button key={o} type="button" onClick={() => setFilter(o)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === o ? 'border-brand bg-brand-muted/50 text-brand-dark'
                           : 'border-stone-200 bg-white text-stone-600 hover:border-brand/50'}`}>
            {o}
          </button>
        ))}
      </div>

      {templates === null ? (
        <div className="flex items-center justify-center py-16 text-stone-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> loading…
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500">
          Nothing saved yet. Run the Lab, and when a card deserves to live forever, hit “Save to catalogue”.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <div key={t.id} className="group overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="aspect-square bg-stone-50">
                {/* crossOrigin: card-image rule — see project_3d_card_cors_cache_poisoning */}
                <img src={t.imageUrl} alt={t.front_text} crossOrigin="anonymous" className="h-full w-full object-cover" />
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-snug text-stone-800">“{t.front_text}”</p>
                  <Button variant="ghost" size="sm" onClick={() => remove(t)}
                    className="h-7 w-7 shrink-0 p-0 text-stone-300 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                    aria-label={`Delete template: ${t.front_text}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] capitalize text-stone-400">
                  {t.occasion}{t.angle ? ` · ${t.angle}` : ''}{t.recipient ? ` · for ${t.recipient}` : ''}
                </p>
                {t.interest && <p className="text-[11px] text-stone-400">{t.interest}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
