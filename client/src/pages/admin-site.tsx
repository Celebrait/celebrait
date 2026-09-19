// client/src/pages/admin-site.tsx — the pre-launch lock switch.
//
// On: visitors get the launching-soon page and the early-access list;
// the share password (or an admin sign-in) lets people through.
// Off: the full site. Sign-ups land in Customers → Leads, source
// "early-access".

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Lock { locked: boolean; password: string }

export default function AdminSitePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Lock>({
    queryKey: ['/api/admin/site-lock'],
    queryFn: async () => { const r = await fetch('/api/admin/site-lock', { credentials: 'include' }); if (!r.ok) throw new Error('load'); return r.json(); },
  });
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (data) setPassword(data.password); }, [data]);

  const save = async (patch: Partial<Lock>) => {
    setSaving(true); setNote('');
    try {
      const r = await fetch('/api/admin/site-lock', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error('save');
      qc.setQueryData(['/api/admin/site-lock'], await r.json());
      void qc.invalidateQueries({ queryKey: ['/api/site-lock'] });
      setNote('Saved.');
    } catch { setNote('Could not save — try again.'); } finally { setSaving(false); }
  };

  if (isLoading || !data) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-keeper-meta" /></div>;
  const share = typeof window !== 'undefined' ? window.location.origin : 'https://www.celebrait.co.uk';

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-2xl font-bold text-keeper-ink">Site lock</h1>
      <p className="mt-1 text-sm text-keeper-body">Before launch, visitors see the launching-soon page and can join the early-access list. You always get through while signed in as admin.</p>

      <div className={`mt-6 flex items-center justify-between gap-4 rounded-2xl border p-5 ${data.locked ? 'border-brand/40 bg-brand-muted' : 'border-keeper-hair bg-white'}`}>
        <div className="flex items-center gap-3">
          {data.locked ? <Lock className="h-6 w-6 text-brand-dark" /> : <LockOpen className="h-6 w-6 text-keeper-meta" />}
          <div>
            <p className="font-semibold text-keeper-ink">{data.locked ? 'Locked — launching-soon page is showing' : 'Open — the full site is live'}</p>
            <p className="text-[13px] text-keeper-body">{data.locked ? 'Only people with the password (and admins) see the site.' : 'Everyone sees the full site.'}</p>
          </div>
        </div>
        <button type="button" disabled={saving} onClick={() => save({ locked: !data.locked })}
          className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${data.locked ? 'border border-keeper-hair bg-white text-keeper-ink hover:border-keeper-ink' : 'bg-cta text-cta-foreground hover:bg-cta-hover'}`}>
          {data.locked ? 'Open the site' : 'Lock the site'}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-keeper-hair bg-white p-5">
        <label htmlFor="site-pass" className="block font-semibold text-keeper-ink">Early-access password</label>
        <p className="mt-0.5 text-[13px] text-keeper-body">Share this with people you want to let in. Not case-sensitive. Changing it signs everyone else out of the preview.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input id="site-pass" value={password} onChange={(e) => setPassword(e.target.value.slice(0, 60))}
            className="h-11 flex-1 rounded-full border border-keeper-hair px-4 text-[15px] text-keeper-ink focus:border-brand focus:outline-none" />
          <button type="button" disabled={saving || password.trim() === data.password} onClick={() => save({ password: password.trim() })}
            className="h-11 rounded-full bg-keeper-ink px-5 text-sm font-semibold text-keeper-paper disabled:opacity-40">Save password</button>
        </div>
        {!password.trim() && <p className="mt-2 text-[13px] text-accent-red-dark">With no password, only admins can get past the page.</p>}
      </div>

      {note && <p className="mt-3 text-sm text-keeper-body">{note}</p>}
      <p className="mt-6 text-sm text-keeper-body">
        Sign-ups: <Link href="/admin/customers" className="font-medium text-brand-dark underline underline-offset-2">Customers → Leads</Link>, source “early-access”. Preview the page in a private window at {share}.
      </p>
    </div>
  );
}
