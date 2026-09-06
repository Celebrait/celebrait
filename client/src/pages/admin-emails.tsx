// client/src/pages/admin-emails.tsx
//
// Email tester admin page — pick a template, see it rendered in an
// iframe, then send for real if it looks good. Lives at /admin/emails.
// Mirrors /admin/prompts and /admin/costs chrome.
//
// Two-pane layout:
//   Left  — list of every transactional template the
//           admin-test-email route supports, grouped by lifecycle
//           stage. Click a card to select it.
//   Right — live HTML preview of the selected template, rendered
//           server-side via /api/admin/test-email/:template/preview
//           (which runs the template inside renderEmailForPreview()
//           and returns the captured subject + html + text). Uses the
//           same render path as a real send, so what you see is what
//           the inbox would get.
//
// Dev loop:
//   1. Edit copy in server/email-service.ts
//   2. Server auto-restarts (tsx watch — package.json:dev)
//   3. Refresh preview pane
//   4. See changes
//
// "Send to inbox" still available via the right-pane CTA — fires the
// existing POST /api/admin/test-email/:template path.
//
// Includes the occasion reminders (T-21 / T-7 / T-3, tier encoded in the
// template name → default day-counts) and the OTP login-code email
// (dummy code) — added 2026-07-11.

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, Loader2, RefreshCw, Send, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// ─── Catalog ──────────────────────────────────────────────────────────

type EmailTemplate =
  | 'card-ready'
  | 'generation-failed'
  | 'recipient-card-arrived'
  | 'sender-order-confirmed'
  | 'sender-card-opened'
  | 'sender-print-shipped'
  | 'sender-print-delivered'
  | 'dropoff-recovery'
  | 'dropoff-tweak'
  | 'dropoff-last-call'
  | 'reminder-t21'
  | 'reminder-t7'
  | 'reminder-t3'
  | 'otp'
  | 'make-your-own'
  | 'welcome';

interface EmailEntry {
  template: EmailTemplate;
  label: string;
  description: string;
  who: 'sender' | 'recipient';
}

interface EmailGroup {
  groupLabel: string;
  emails: EmailEntry[];
}

const EMAIL_GROUPS: EmailGroup[] = [
  {
    groupLabel: 'Card lifecycle',
    emails: [
      { template: 'card-ready', label: 'Card ready', description: 'Sender, gen finished, time to buy.', who: 'sender' },
      { template: 'generation-failed', label: 'Generation failed', description: 'Sender, the gen errored.', who: 'sender' },
    ],
  },
  {
    groupLabel: 'Drop-off cadence',
    emails: [
      { template: 'dropoff-recovery', label: 'Drop-off #1 — Day 1', description: '"{Recipient}\'s card is still waiting"', who: 'sender' },
      { template: 'dropoff-tweak', label: 'Drop-off #2 — Day 4', description: '"Want to tweak {Recipient}\'s card?"', who: 'sender' },
      { template: 'dropoff-last-call', label: 'Drop-off #3 — Day 10', description: '"Last note about {Recipient}\'s card"', who: 'sender' },
    ],
  },
  {
    groupLabel: 'Post-purchase',
    emails: [
      { template: 'sender-order-confirmed', label: 'Order confirmed', description: 'Sender, payment went through.', who: 'sender' },
      { template: 'sender-card-opened', label: 'Recipient opened it', description: 'Sender, recipient viewed digital card.', who: 'sender' },
      { template: 'sender-print-shipped', label: 'Print shipped', description: 'Sender, physical card on the way.', who: 'sender' },
      { template: 'sender-print-delivered', label: 'Print delivered', description: 'Sender, physical card has arrived.', who: 'sender' },
    ],
  },
  {
    groupLabel: 'Recipient',
    emails: [
      { template: 'recipient-card-arrived', label: 'Card arrived (digital)', description: 'Recipient, your digital card is here.', who: 'recipient' },
    ],
  },
  {
    groupLabel: 'Occasion reminders',
    emails: [
      { template: 'reminder-t21', label: 'Reminder — 21 days', description: '"{Recipient}\'s {occasion} is in 21 days"', who: 'sender' },
      { template: 'reminder-t7', label: 'Reminder — 7 days', description: '"…is in 7 days" — time to make it.', who: 'sender' },
      { template: 'reminder-t3', label: 'Reminder — 3 days', description: '"…is in 3 days" — pick fast delivery.', who: 'sender' },
    ],
  },
  {
    groupLabel: 'Acquisition & onboarding',
    emails: [
      { template: 'welcome', label: 'Welcome', description: 'New signup — warm hello + make your first card.', who: 'sender' },
      { template: 'make-your-own', label: 'Make your own (link)', description: 'Lead asked us to email them the link.', who: 'recipient' },
    ],
  },
  {
    groupLabel: 'Auth',
    emails: [
      { template: 'otp', label: 'Login code (OTP)', description: 'The 6-digit verification code email.', who: 'sender' },
    ],
  },
];

interface PreviewResponse {
  ok: boolean;
  template: string;
  rendered: {
    subject: string;
    html: string;
    text: string;
    to: string;
  };
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function AdminEmailsPage() {
  const { toast } = useToast();
  const [cardIdInput, setCardIdInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [selected, setSelected] = useState<EmailTemplate>('card-ready');
  const [previewMode, setPreviewMode] = useState<'rendered' | 'html' | 'text'>('rendered');

  // Editable buffers — populated from the preview's rendered output,
  // freely editable by the admin. The "Send to inbox" button uses
  // these values: if any have been edited from the rendered baseline,
  // it fires the raw-send endpoint with the edited content; if
  // unchanged, it fires the normal template-send (which re-renders
  // server-side). One-off override: changes don't persist anywhere
  // — switching templates or hitting Refresh resets them.
  const [editedSubject, setEditedSubject] = useState('');
  const [editedHtml, setEditedHtml] = useState('');
  const [editedText, setEditedText] = useState('');

  const buildBody = () => {
    const body: { cardId?: number; to?: string } = {};
    const cardId = cardIdInput.trim() ? Number(cardIdInput.trim()) : null;
    if (cardId !== null && Number.isFinite(cardId)) body.cardId = cardId;
    if (toInput.trim()) body.to = toInput.trim();
    return body;
  };

  // Preview mutation — fires on demand (refresh button) so the user
  // controls when the iframe re-renders. Avoids hammering the server
  // on every keystroke.
  const previewMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const res = await apiRequest('POST', `/api/admin/test-email/${template}/preview`, buildBody());
      return (await res.json()) as PreviewResponse;
    },
    onError: (err: Error) => {
      toast({
        title: 'Preview failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const res = await apiRequest('POST', `/api/admin/test-email/${template}`, buildBody());
      return (await res.json()) as { ok: boolean; template: string; to: string };
    },
    onSuccess: (data) => {
      toast({
        title: data.ok ? 'Email sent' : 'Email reported failure',
        description: data.ok
          ? `${data.template} → ${data.to}. Check your inbox.`
          : `${data.template} returned ok=false. Check server logs.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Send failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Raw send — bypasses template render, sends whatever's in the
  // edited buffers. Used when the admin has tweaked subject/html/text.
  const sendRawMutation = useMutation({
    mutationFn: async (payload: { subject: string; html: string; text: string }) => {
      const res = await apiRequest('POST', '/api/admin/test-email/raw', {
        ...payload,
        ...(toInput.trim() ? { to: toInput.trim() } : {}),
      });
      return (await res.json()) as { ok: boolean; to: string };
    },
    onSuccess: (data) => {
      toast({
        title: data.ok ? 'Edited email sent' : 'Email reported failure',
        description: data.ok
          ? `Sent to ${data.to}. Note: edits don't persist — next preview reverts to source.`
          : 'Server returned ok=false. Check logs.',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Send failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const dropoffCronMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/recovery/dispatch', {});
      return (await res.json()) as {
        examined?: number;
        fired?: number;
        skipped?: unknown[];
        errors?: unknown[];
      };
    },
    onSuccess: (data) => {
      toast({
        title: 'Drop-off cron pass complete',
        description: `Examined ${data.examined ?? 0}, fired ${data.fired ?? 0}, skipped ${data.skipped?.length ?? 0}, errors ${data.errors?.length ?? 0}.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Cron run failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleSelect = (template: EmailTemplate) => {
    setSelected(template);
    previewMutation.mutate(template);
  };

  const handleRefresh = () => previewMutation.mutate(selected);

  const rendered = previewMutation.data?.rendered;

  // Sync edited buffers from preview every time a preview lands.
  // This resets any in-flight edits — explicit and intended (Refresh
  // = reset). Switching templates triggers a new preview which
  // triggers a reset via this effect.
  useEffect(() => {
    if (rendered) {
      setEditedSubject(rendered.subject);
      setEditedHtml(rendered.html);
      setEditedText(rendered.text);
    }
  }, [rendered]);

  // Dirty = any of the editable fields differ from the rendered
  // baseline. Drives the "Edited" badge + decides which send path
  // fires when the user clicks Send.
  const isDirty =
    !!rendered &&
    (editedSubject !== rendered.subject ||
      editedHtml !== rendered.html ||
      editedText !== rendered.text);

  const handleSend = () => {
    if (isDirty) {
      sendRawMutation.mutate({
        subject: editedSubject,
        html: editedHtml,
        text: editedText,
      });
    } else {
      sendMutation.mutate(selected);
    }
  };

  const sendInFlight = sendMutation.isPending || sendRawMutation.isPending;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-5 h-5 text-brand" />
          <h1 className="text-2xl font-semibold text-ink">Email tester</h1>
        </div>
        <p className="text-sm text-ink-soft max-w-2xl">
          Pick a template on the left → see the rendered HTML on the right →
          send to your inbox if it looks right. Edit copy in{' '}
          <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">
            server/email-service.ts
          </code>
          ; server auto-restarts on save (tsx watch), then hit refresh.
        </p>
      </div>

      {/* Optional inputs — apply to both preview and send */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200">
        <div>
          <Label htmlFor="cardId" className="text-[10px] uppercase tracking-wider text-ink-soft font-semibold">
            Card ID (optional)
          </Label>
          <Input
            id="cardId"
            type="number"
            placeholder="e.g. 123 — leave blank for dummy data"
            value={cardIdInput}
            onChange={(e) => setCardIdInput(e.target.value)}
            className="mt-1 bg-white h-9 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="toAddress" className="text-[10px] uppercase tracking-wider text-ink-soft font-semibold">
            Override "to" (optional)
          </Label>
          <Input
            id="toAddress"
            type="email"
            placeholder="defaults to your admin email"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="mt-1 bg-white h-9 text-sm"
          />
        </div>
      </div>

      {/* Two-pane layout — template list (left) + preview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* LEFT — Template list, grouped */}
        <div className="space-y-5">
          {EMAIL_GROUPS.map(({ groupLabel, emails }) => (
            <section key={groupLabel}>
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-ink-soft font-semibold mb-2 px-1">
                {groupLabel}
              </h2>
              <div className="space-y-1.5">
                {emails.map((entry) => {
                  const isSelected = selected === entry.template;
                  return (
                    <button
                      key={entry.template}
                      type="button"
                      onClick={() => handleSelect(entry.template)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-brand bg-brand/5'
                          : 'border-stone-200 bg-white hover:border-brand/40'
                      }`}
                      data-testid={`email-card-${entry.template}`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-ink">{entry.label}</p>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${
                            entry.who === 'sender'
                              ? 'bg-brand/10 text-brand-dark'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {entry.who}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-soft leading-snug">
                        {entry.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Drop-off cron trigger — sits below the lists since it's
              a system action, not a per-template send. */}
          <div className="mt-6 p-3 rounded-xl bg-amber-50/50 border border-amber-200/60">
            <h3 className="text-xs font-semibold text-ink mb-1">Run drop-off cron</h3>
            <p className="text-[11px] text-ink-soft mb-2 leading-snug">
              Fires the full 3-tier dispatcher across all eligible cards.
              Idempotent. WILL fire real emails to real users.
            </p>
            <Button
              size="sm"
              onClick={() => dropoffCronMutation.mutate()}
              disabled={dropoffCronMutation.isPending}
              className="bg-brand hover:bg-brand-dark text-brand-foreground w-full text-xs h-8"
              data-testid="run-dropoff-cron"
            >
              {dropoffCronMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Running…
                </>
              ) : (
                'Run cron pass'
              )}
            </Button>
          </div>
        </div>

        {/* RIGHT — Preview pane */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col min-h-[600px]">
          {/* Toolbar — editable subject + view-mode toggle + actions.
              Subject is an inline editable input (one-off override
              support). Dirty badge shows when any edited field
              diverges from the rendered baseline. */}
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] uppercase tracking-wider text-ink-soft font-semibold">
                    Subject
                  </p>
                  {isDirty && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-700">
                      <Pencil className="w-2.5 h-2.5" />
                      Edited
                    </span>
                  )}
                </div>
                {previewMutation.isPending && !rendered ? (
                  <p className="text-sm text-ink-soft">Loading…</p>
                ) : (
                  <Input
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    placeholder="(no subject)"
                    className="bg-white h-8 text-sm font-medium"
                    disabled={!rendered}
                    data-testid="email-preview-subject"
                  />
                )}
                {rendered?.to && (
                  <p className="text-[11px] text-ink-soft mt-1 truncate">
                    to {rendered.to}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="inline-flex bg-white border border-stone-200 rounded-md p-0.5">
                  {(['rendered', 'html', 'text'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                        previewMode === mode
                          ? 'bg-brand text-brand-foreground'
                          : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      {mode === 'rendered' ? 'Preview' : mode === 'html' ? 'HTML' : 'Text'}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={previewMutation.isPending}
                  className="text-xs h-8"
                  data-testid="email-preview-refresh"
                  title={isDirty ? 'Resets your edits to source' : 'Re-fetches from source'}
                >
                  <RefreshCw
                    className={`w-3 h-3 mr-1.5 ${previewMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={sendInFlight || !rendered}
                  className="bg-brand hover:bg-brand-dark text-brand-foreground text-xs h-8"
                  data-testid="email-preview-send"
                >
                  <Send className="w-3 h-3 mr-1.5" />
                  {sendInFlight ? 'Sending…' : isDirty ? 'Send edited' : 'Send to inbox'}
                </Button>
              </div>
            </div>
          </div>

          {/* Preview body — three modes. HTML and Text are editable
              textareas; Preview is a sandboxed iframe rendering the
              CURRENT editedHtml (so your edits show live in the
              rendered view). */}
          <div className="flex-1 bg-stone-100 overflow-hidden flex flex-col">
            {previewMutation.isPending && !rendered ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
              </div>
            ) : !rendered ? (
              <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                Select a template to preview.
              </div>
            ) : previewMode === 'rendered' ? (
              <iframe
                title="Email preview"
                srcDoc={editedHtml}
                className="w-full h-full bg-white"
                sandbox=""
                data-testid="email-preview-iframe"
              />
            ) : previewMode === 'html' ? (
              <Textarea
                value={editedHtml}
                onChange={(e) => setEditedHtml(e.target.value)}
                spellCheck={false}
                className="w-full flex-1 bg-stone-900 text-stone-100 border-0 rounded-none p-4 text-[11px] font-mono leading-relaxed resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                data-testid="email-preview-html-editor"
              />
            ) : (
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                spellCheck={false}
                placeholder="(no plain-text part)"
                className="w-full flex-1 bg-white border-0 rounded-none p-4 text-sm font-mono leading-relaxed resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                data-testid="email-preview-text-editor"
              />
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        Reminders preview at their default day-counts (21 / 7 / 3); the OTP
        uses a dummy code. Pass a card ID to ground the reminder's "last
        time you sent this" image in real card art.
      </p>
    </div>
  );
}
