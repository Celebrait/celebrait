// client/src/pages/studio-address-book-form.tsx
//
// Create + edit form for an address book entry. One component, two
// routes: /studio/people/address-book/new and /:id/edit.
//
// Sections (all collapsible-by-natural-grouping, not toggle-collapse):
//   • Name + relationship  (required: name)
//   • Contact: email + phone
//   • Address (5 fields)
//   • Occasions (repeater — add/remove rows; date can be blank)
//   • Notes
//
// Validation mirrors the server's Zod schema. On submit, name dedup is
// soft-blocked at the server (409 with existingId) — when that fires
// we route to the existing entry's edit page rather than refusing to
// save.

import { useEffect, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Cake,
  Calendar,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { OCCASION_PRESETS } from '@/components/studio/scene-presets';
import type {
  AddressBookEntry,
  RecipientOccasionRow,
  PostalAddress,
} from '@shared/schema';

interface EntryWithOccasions extends AddressBookEntry {
  occasions: RecipientOccasionRow[];
}

// Local form state for occasions — `id` is null for unsaved (new)
// rows; existing rows keep their server id so PATCH/DELETE can
// target them precisely. The form diffs add/edit/delete on submit.
interface OccasionFormState {
  /** Server id; null until saved. */
  id: number | null;
  occasion: string;
  date: string; // YYYY-MM-DD or '' for "no date yet"
  yearSpecific: boolean;
  notes: string;
}

// The occasion list shown in the dropdown. Mirrors OCCASION_PRESETS
// keys plus a few extras + 'other' as a free-form fallback.
const OCCASION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'baby', label: 'New baby' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'christmas', label: 'Christmas' },
  { value: 'valentines', label: "Valentine's Day" },
  { value: 'mothers_day', label: "Mother's Day" },
  { value: 'fathers_day', label: "Father's Day" },
  { value: 'thankyou', label: 'Thank you' },
  { value: 'sympathy', label: 'Sympathy' },
  { value: 'other', label: 'Other' },
];

// ─────────────────────────────────────────────────────────────────────
// Occasion-aware date semantics.
//
// What the user is actually entering varies by occasion:
//   • Birthday  → DATE OF BIRTH (Mum's actual DOB; reminder fires
//     yearly on month/day; we can also surface "It's her 60th!").
//   • Anniversary / Wedding / Engagement → the date the event happened.
//     Reminder fires yearly on month/day; year sets the count ("their
//     5th anniversary").
//   • New baby → the baby's date of birth.
//   • Graduation → graduation date (one-off-ish — usually doesn't recur).
//   • Christmas, Valentine's, Mother's Day, Father's Day → FIXED DATE.
//     We already know when these are. No input needed; just remind on
//     the calendar date each year.
//   • Thank you, sympathy, other → optional "date the event happened".
//
// Helpers below drive the form's date label + visibility per occasion.
// ─────────────────────────────────────────────────────────────────────

/** Occasions where the date is universally known (fixed calendar
 *  date). For these, the form hides the date input entirely. */
const FIXED_DATE_OCCASIONS = new Set([
  'christmas',
  'valentines',
  'mothers_day',
  'fathers_day',
]);

/** Human-readable date-the-fixed-occasion-falls-on, shown as a tiny
 *  helper line where the date input would have been. */
const FIXED_DATE_NOTES: Record<string, string> = {
  christmas: '25 December — we know.',
  valentines: '14 February — we know.',
  mothers_day: 'Second Sunday of May (UK / SA pattern).',
  fathers_day: 'Third Sunday of June.',
};

/** Field label for the date input, occasion-aware. The reminder
 *  itself fires on month/day; the year on file gives us age / count
 *  signal where relevant. */
function dateLabelForOccasion(occasion: string): string {
  switch (occasion) {
    case 'birthday':
    case 'baby':
      return 'Date of birth';
    case 'anniversary':
      return 'Anniversary date';
    case 'wedding':
      return 'Wedding date';
    case 'engagement':
      return 'Engagement date';
    case 'graduation':
      return 'Graduation date';
    default:
      return 'Date';
  }
}

/** Hint text below the date input, explaining what we'll do with it.
 *  Only shown when the date is currently empty (per the existing
 *  Field hint pattern). */
function dateHintForOccasion(occasion: string): string {
  switch (occasion) {
    case 'birthday':
    case 'baby':
      return "We'll remind you each year on the day.";
    case 'anniversary':
    case 'wedding':
    case 'engagement':
      return "We'll remind you each year — and know which anniversary it is.";
    default:
      return "We need this to remind you in time";
  }
}

/** Whether the year-specific checkbox makes sense for this occasion.
 *  Birthdays / anniversaries are always recurring (year ignored for
 *  the reminder); checkbox is noise. Hide it. */
function showsYearSpecificToggle(occasion: string): boolean {
  // The toggle's job is "this is a one-off event that won't recur"
  // (e.g. a specific graduation, a specific wedding date you'd skip
  // in subsequent years). For inherently-yearly occasions, hide it.
  if (FIXED_DATE_OCCASIONS.has(occasion)) return false;
  if (occasion === 'birthday' || occasion === 'baby' || occasion === 'anniversary') {
    return false;
  }
  return true;
}

// Suppress lint — used implicitly via OCCASION_OPTIONS; might surface
// later for occasion-aware copy.
void OCCASION_PRESETS;

interface AddressBookFormPageProps {
  mode: 'new' | 'edit';
}

export default function AddressBookFormPage({ mode }: AddressBookFormPageProps) {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>('/studio/people/address-book/:id/edit');
  const idFromUrl = params?.id ? parseInt(params.id, 10) : null;
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('');
  const [notes, setNotes] = useState('');
  const [occasionRows, setOccasionRows] = useState<OccasionFormState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Load existing entry on edit ────────────────────────────────
  const { data: existing, isLoading: isLoadingExisting } = useQuery<EntryWithOccasions>({
    queryKey: [`/api/user/address-book/${idFromUrl}`],
    enabled: mode === 'edit' && !!idFromUrl,
  });

  useEffect(() => {
    if (mode !== 'edit' || !existing) return;
    setName(existing.name ?? '');
    setRelationship(existing.relationship ?? '');
    setEmail(existing.email ?? '');
    setPhone(existing.phone ?? '');
    const addr = existing.address ?? null;
    setAddressLine1(addr?.line1 ?? '');
    setAddressLine2(addr?.line2 ?? '');
    setCity(addr?.city ?? '');
    setRegion(addr?.region ?? '');
    setPostcode(addr?.postcode ?? '');
    setCountry(addr?.country ?? '');
    setNotes(existing.notes ?? '');
    setOccasionRows(
      existing.occasions.map((o) => ({
        id: o.id,
        occasion: o.occasion,
        date: o.date ?? '',
        yearSpecific: o.yearSpecific ?? false,
        notes: o.notes ?? '',
      })),
    );
  }, [mode, existing]);

  // ── Mutations ──────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload({
        name,
        relationship,
        email,
        phone,
        address: buildAddress({ addressLine1, addressLine2, city, region, postcode, country }),
        notes,
        occasions: occasionRows,
      });
      const res = await apiRequest('POST', '/api/user/address-book', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/address-book'] });
      // Reminders feed is derived from occasions — must invalidate so the
      // Studio Home "Coming up" widget picks up a freshly-added birthday
      // on the next render. Without this, the widget shows stale cache.
      queryClient.invalidateQueries({ queryKey: ['/api/user/reminders'] });
      toast({ title: `${name.trim()} added`, variant: 'success' });
      setLocation('/studio/people/address-book');
    },
    onError: async (err: any) => {
      // 409 = duplicate name; route to existing entry's edit page.
      const status = err?.status ?? err?.response?.status;
      const existingId = err?.body?.existingId ?? err?.response?.data?.existingId;
      if (status === 409 && existingId) {
        toast({
          title: `You already have a ${name.trim()} saved`,
          description: 'Opening their entry so you can update it.',
        });
        setLocation(`/studio/people/address-book/${existingId}/edit`);
        return;
      }
      toast({
        title: "Couldn't save",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!idFromUrl) throw new Error('Missing id');

      // PATCH the entry-level fields first.
      const entryPayload = buildPayload({
        name,
        relationship,
        email,
        phone,
        address: buildAddress({ addressLine1, addressLine2, city, region, postcode, country }),
        notes,
        occasions: undefined, // occasions go via separate endpoints
      });
      await apiRequest('PATCH', `/api/user/address-book/${idFromUrl}`, entryPayload);

      // Diff occasions vs the loaded `existing` snapshot.
      const existingIds = new Set((existing?.occasions ?? []).map((o) => o.id));
      const currentIds = new Set(
        occasionRows.filter((o) => o.id !== null).map((o) => o.id as number),
      );

      // Deletes: rows that existed before but aren't in the form now.
      const toDelete = Array.from(existingIds).filter((id) => !currentIds.has(id));
      for (const occId of toDelete) {
        await apiRequest(
          'DELETE',
          `/api/user/address-book/${idFromUrl}/occasions/${occId}`,
        );
      }

      // Adds: rows with id=null.
      for (const row of occasionRows.filter((o) => o.id === null)) {
        await apiRequest('POST', `/api/user/address-book/${idFromUrl}/occasions`, {
          occasion: row.occasion,
          date: row.date || null,
          yearSpecific: row.yearSpecific,
          notes: row.notes.trim() || null,
        });
      }

      // Updates: rows with id that have changed since load.
      for (const row of occasionRows.filter((o) => o.id !== null)) {
        const original = existing?.occasions.find((o) => o.id === row.id);
        if (!original) continue;
        const changed =
          original.occasion !== row.occasion ||
          (original.date ?? '') !== row.date ||
          original.yearSpecific !== row.yearSpecific ||
          (original.notes ?? '') !== row.notes;
        if (!changed) continue;
        await apiRequest(
          'PATCH',
          `/api/user/address-book/${idFromUrl}/occasions/${row.id}`,
          {
            occasion: row.occasion,
            date: row.date || null,
            yearSpecific: row.yearSpecific,
            notes: row.notes.trim() || null,
          },
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/address-book'] });
      queryClient.invalidateQueries({
        queryKey: [`/api/user/address-book/${idFromUrl}`],
      });
      // Reminders feed is derived from occasions — must invalidate so
      // the Studio Home "Coming up" widget reflects edits to dates /
      // added or removed occasions on the next render.
      queryClient.invalidateQueries({ queryKey: ['/api/user/reminders'] });
      // Name-weave the saved-toast like the create-toast does — the
      // form has the name in scope, may as well land warmer.
      const savedName = name.trim();
      toast({
        title: savedName ? `Saved — ${savedName}'s all set` : 'Saved',
        variant: 'success',
      });
      setLocation('/studio/people/address-book');
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  // ── Form handlers ─────────────────────────────────────────────
  const addOccasion = () => {
    setOccasionRows((rows) => [
      ...rows,
      { id: null, occasion: 'birthday', date: '', yearSpecific: false, notes: '' },
    ]);
  };

  const updateOccasion = (
    index: number,
    patch: Partial<OccasionFormState>,
  ) => {
    setOccasionRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const removeOccasion = (index: number) => {
    setOccasionRows((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: 'Pop in a name first.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === 'edit') {
        await updateMutation.mutateAsync();
      } else {
        await createMutation.mutateAsync();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'edit' && isLoadingExisting) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  // Recipient-name-as-title is Celebrait's signature ("Mum's birthday card",
  // "Mum's card is on its way"). The page chrome (back link, save button)
  // already implies the verb, so the H1 doesn't need "Edit" — it just needs
  // to centre the person.
  const heading = mode === 'edit' ? (existing?.name ?? 'Edit entry') : 'Add someone';
  // Submit label for create-mode weaves the typed name in once entered —
  // "Add Mum" lands warmer than "Add to address book". Falls back when
  // the name is still blank.
  const trimmedName = name.trim();
  const submitLabel = mode === 'edit'
    ? (isSubmitting ? 'Saving…' : 'Save changes')
    : (isSubmitting
        ? 'Adding…'
        : trimmedName
          ? `Add ${trimmedName}`
          : 'Add to address book');

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/studio/people/address-book"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink mb-3"
          data-testid="btn-back-to-address-book"
        >
          <ArrowLeft className="w-4 h-4" />
          Address book
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold text-ink">{heading}</h1>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Name + relationship */}
        <FormSection title="Who are they?">
          <div className="space-y-3">
            <Field label="Name" required htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mum, Dad, Auntie Sue…"
                maxLength={80}
                autoFocus={mode === 'new'}
                data-testid="input-ab-name"
              />
            </Field>
            <Field
              label="Relationship"
              optional
              htmlFor="relationship"
              hint="What you'd say to a friend. Never shows up on the card."
            >
              <Input
                id="relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Mother, partner, best friend…"
                maxLength={40}
                data-testid="input-ab-relationship"
              />
            </Field>
          </div>
        </FormSection>

        {/* Occasions */}
        <FormSection
          title="Occasions"
          subtitle="When are their big days? We'll quietly remind you in time."
        >
          {occasionRows.length === 0 ? (
            <div className="bg-stone-50 border border-dashed border-stone-300 rounded-xl px-4 py-6 text-center">
              <Cake className="w-5 h-5 text-stone-400 mx-auto mb-2" />
              <p className="text-sm text-stone-600 mb-3">
                Pop in a birthday or anniversary — we'll nudge you in good time.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOccasion}
                data-testid="btn-add-first-occasion"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add an occasion
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {occasionRows.map((row, idx) => (
                <OccasionRow
                  key={row.id ?? `new-${idx}`}
                  row={row}
                  index={idx}
                  onChange={(patch) => updateOccasion(idx, patch)}
                  onRemove={() => removeOccasion(idx)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOccasion}
                data-testid="btn-add-occasion"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add another
              </Button>
            </div>
          )}
        </FormSection>

        {/* Contact */}
        <FormSection
          title="Contact"
          subtitle="Email is where we send their card's digital link. Phone is just for your records."
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Email" optional htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="them@example.com"
                data-testid="input-ab-email"
              />
            </Field>
            <Field label="Phone" optional htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44…"
                maxLength={40}
                data-testid="input-ab-phone"
              />
            </Field>
          </div>
        </FormSection>

        {/* Postal address */}
        <FormSection
          title="Postal address"
          subtitle="For posting their printed card."
        >
          <div className="space-y-3">
            <Field label="Address line 1" optional htmlFor="addr1">
              <Input
                id="addr1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="12 Maple Street"
                data-testid="input-ab-addr1"
              />
            </Field>
            <Field label="Address line 2" optional htmlFor="addr2">
              <Input
                id="addr2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apt, suite, etc."
                data-testid="input-ab-addr2"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="City" optional htmlFor="city">
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="London"
                  data-testid="input-ab-city"
                />
              </Field>
              <Field label="Region / County" optional htmlFor="region">
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Greater London"
                  data-testid="input-ab-region"
                />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Postcode" optional htmlFor="postcode">
                <Input
                  id="postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="SW1A 1AA"
                  data-testid="input-ab-postcode"
                />
              </Field>
              <Field label="Country" optional htmlFor="country">
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United Kingdom"
                  data-testid="input-ab-country"
                />
              </Field>
            </div>
          </div>
        </FormSection>

        {/* Notes */}
        <FormSection
          title="Notes"
          subtitle="Just for you — gift ideas, in-jokes, things to remember."
        >
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Loves dogs, allergic to pink, always asks about the kids…"
            rows={3}
            maxLength={500}
            className="resize-none"
            data-testid="input-ab-notes"
          />
        </FormSection>
      </div>

      {/* Privacy footer — GDPR table-stakes. Sits below the form so it
          frames the act of saving without slowing it down. The Dialog
          carries the full "what we store" explainer for users who want
          the detail. See next_address_book_reminders_retention.md. */}
      <PrivacyFooter />

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end">
        <Button
          asChild
          variant="outline"
          size="lg"
          className="sm:w-auto"
        >
          <Link href="/studio/people/address-book">Cancel</Link>
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim()}
          className="bg-brand hover:bg-brand-dark text-white sm:w-auto"
          data-testid="btn-ab-save"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// FormSection — consistent card chrome around each grouped fieldset.
// ─────────────────────────────────────────────────────────────────────

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && (
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PrivacyFooter — small reassurance line under the form + dialog with
// the full "what we store" detail.
//
// Why this matters: the form collects DOBs, addresses, phone numbers,
// free-form notes — all personal data about people who haven't
// consented (their friend signed them up). UK GDPR doesn't make that
// illegal (legitimate interest covers a private address book), but it
// does require we tell the *sender* clearly what we do with it, and
// give them a clean way to remove anyone. The per-row Remove action
// already exists; this footer is the visible disclosure half. See
// next_address_book_reminders_retention.md.
// ─────────────────────────────────────────────────────────────────────

function PrivacyFooter() {
  return (
    <div className="mt-6 flex items-start gap-2.5 text-xs text-stone-500 leading-relaxed px-1">
      <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-stone-400" aria-hidden />
      <p>
        Stored privately — only you can see it. Remove anyone any time from
        the address book menu.{' '}
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="underline underline-offset-2 text-stone-600 hover:text-ink focus:outline-none focus:text-ink"
              data-testid="btn-ab-privacy-detail"
            >
              What we store
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>What we store, in plain English</DialogTitle>
              <DialogDescription>
                Your address book lives in your account so we can remind
                you about the people who matter and pre-fill cards for
                them.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
              <div>
                <p className="font-medium text-ink mb-1">What we keep</p>
                <p>
                  Just what you type — names, relationships, occasion
                  dates, contact details, and your private notes. Nothing
                  is shared with anyone else.
                </p>
              </div>
              <div>
                <p className="font-medium text-ink mb-1">What we do with it</p>
                <p>
                  We use it to send <em>you</em> reminders before each
                  occasion, and to pre-fill the recipient step when you
                  start a new card. That's it — no marketing to your
                  contacts, no third-party sharing, no resale.
                </p>
              </div>
              <div>
                <p className="font-medium text-ink mb-1">Removing someone</p>
                <p>
                  Hit the ⋯ menu next to anyone in the address book and
                  choose Remove. We delete the entry, their occasions,
                  and any reminder history attached to them.
                </p>
              </div>
              <div>
                <p className="font-medium text-ink mb-1">Your rights</p>
                <p>
                  Under UK GDPR you can ask us to export or delete
                  everything we hold about you — email{' '}
                  <a
                    href="mailto:privacy@celebrait.co.uk"
                    className="underline underline-offset-2 text-stone-700 hover:text-ink"
                  >
                    privacy@celebrait.co.uk
                  </a>{' '}
                  and we'll handle it within 30 days.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Field — label + required indicator + slot for input + hint.
//
// "(optional)" deliberately omitted (audit 2026-04-29). The form is
// permissive by design — only `Name` is required. Marking eight fields
// as "(optional)" makes the form *look* longer than it is. Convention
// across the studio (recipient-step, inside-step) is: red `*` on the
// required field, nothing on the rest. The `optional` prop is kept on
// the component signature for caller compatibility but no longer
// renders.
// ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** Accepted for backward-compat with existing callers. Ignored —
   *  see the section comment above. */
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} className="text-xs flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-[11px] text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// OccasionRow — a single occasion in the form repeater.
// ─────────────────────────────────────────────────────────────────────

function OccasionRow({
  row,
  index,
  onChange,
  onRemove,
}: {
  row: OccasionFormState;
  index: number;
  onChange: (patch: Partial<OccasionFormState>) => void;
  onRemove: () => void;
}) {
  // Date input semantics vary by occasion (audit 2026-04-29):
  // birthday → "Date of birth", anniversary → "Anniversary date", etc.
  // Fixed-date occasions (Christmas, Valentine's, Mother's/Father's Day)
  // hide the date input entirely — we already know when those are.
  const dateLabel = dateLabelForOccasion(row.occasion);
  const dateHint = dateHintForOccasion(row.occasion);
  const isFixedDate = FIXED_DATE_OCCASIONS.has(row.occasion);
  const fixedDateNote = isFixedDate ? FIXED_DATE_NOTES[row.occasion] : null;
  const showYearSpecific = showsYearSpecificToggle(row.occasion);

  return (
    <div
      className="border border-stone-200 rounded-xl p-3 sm:p-4"
      data-testid={`occasion-row-${index}`}
    >
      <div className="flex items-start gap-3">
        <Calendar className="w-4 h-4 text-brand mt-2 shrink-0" />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
            <Field label="Occasion" htmlFor={`occ-${index}-occasion`}>
              <Select
                value={row.occasion}
                onValueChange={(v) => {
                  // When switching to a fixed-date occasion, clear any
                  // stale date the user typed — we won't show it back
                  // and shouldn't store noise.
                  if (FIXED_DATE_OCCASIONS.has(v)) {
                    onChange({ occasion: v, date: '' });
                  } else {
                    onChange({ occasion: v });
                  }
                }}
              >
                <SelectTrigger id={`occ-${index}-occasion`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCCASION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!isFixedDate ? (
              <Field
                label={dateLabel}
                htmlFor={`occ-${index}-date`}
                hint={!row.date ? dateHint : undefined}
              >
                <Input
                  id={`occ-${index}-date`}
                  type="date"
                  value={row.date}
                  onChange={(e) => onChange({ date: e.target.value })}
                  data-testid={`input-occasion-date-${index}`}
                />
              </Field>
            ) : (
              // Fixed-date occasions don't need a date input — we know
              // when they are. Render a small helper line in the slot
              // the date field would have occupied so the layout
              // doesn't jump when the user toggles between occasions.
              <div className="flex items-center text-[11px] text-stone-500 sm:pt-6 leading-relaxed">
                <span>{fixedDateNote}</span>
              </div>
            )}
          </div>
          {showYearSpecific && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`occ-${index}-yearspec`}
                checked={row.yearSpecific}
                onCheckedChange={(v) => onChange({ yearSpecific: !!v })}
              />
              <Label
                htmlFor={`occ-${index}-yearspec`}
                className="text-xs text-stone-600 font-normal cursor-pointer"
              >
                Just this once — a specific year (their 60th, a wedding date)
              </Label>
            </div>
          )}
          <Input
            value={row.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Surprise party? Quiet dinner? Anything we should remember."
            className="text-sm"
            maxLength={200}
            data-testid={`input-occasion-notes-${index}`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-full text-stone-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 transition-colors"
          aria-label="Remove occasion"
          data-testid={`btn-remove-occasion-${index}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

interface AddressInput {
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
}

/** Build an address jsonb blob from the form fields. Returns null when
 *  every field is empty (so we don't store empty {} objects). */
function buildAddress(input: AddressInput): PostalAddress | null {
  const trimmed: PostalAddress = {
    line1: input.addressLine1.trim() || undefined,
    line2: input.addressLine2.trim() || undefined,
    city: input.city.trim() || undefined,
    region: input.region.trim() || undefined,
    postcode: input.postcode.trim() || undefined,
    country: input.country.trim() || undefined,
  };
  const hasAny = Object.values(trimmed).some((v) => v && v.length > 0);
  return hasAny ? trimmed : null;
}

interface PayloadInput {
  name: string;
  relationship: string;
  email: string;
  phone: string;
  address: PostalAddress | null;
  notes: string;
  occasions?: OccasionFormState[];
}

/** Build the JSON payload for create/update. Empty strings collapse to
 *  null so the server doesn't store junk. */
function buildPayload(input: PayloadInput): Record<string, any> {
  const payload: Record<string, any> = {
    name: input.name.trim(),
    relationship: input.relationship.trim() || null,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    address: input.address,
    notes: input.notes.trim() || null,
  };
  if (input.occasions !== undefined) {
    // For CREATE only — POST endpoint accepts initial occasions inline.
    payload.occasions = input.occasions
      .filter((o) => o.occasion)
      .map((o) => ({
        occasion: o.occasion,
        date: o.date || null,
        yearSpecific: o.yearSpecific,
        notes: o.notes.trim() || null,
      }));
  }
  return payload;
}
