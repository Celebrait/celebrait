import { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, Sparkles, CheckCircle, Edit3, X, Lock, CreditCard } from 'lucide-react';

const ART_STYLES = [
  { value: 'ai_decide', label: 'Let AI decide' },
  { value: 'watercolour', label: 'Watercolour' },
  { value: 'oil_painting', label: 'Oil Painting' },
  { value: 'cartoon', label: 'Cartoon / Illustration' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'sketch', label: 'Pencil Sketch' },
  { value: 'pop_art', label: 'Pop Art' },
  { value: 'impressionist', label: 'Impressionist' },
];

const PRINT_PRICE = 9.99;
const REGEN_PRICES = { front: 2.99, inside: 1.99, both: 3.99 };
const REGEN_LABELS = { front: 'New front design', inside: 'New inside message', both: 'Front + inside refresh' };

type RegenType = 'front' | 'inside' | 'both';

function formatCard(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

export default function RegenPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const { toast } = useToast();

  // Auth state
  const [authStatus, setAuthStatus] = useState<'checking' | 'authed' | 'otp-email' | 'otp-code'>('checking');
  const [authEmail, setAuthEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Card data
  const [card, setCard] = useState<any>(null);
  const [cardLoading, setCardLoading] = useState(true);
  const [cardError, setCardError] = useState('');

  // Edit state
  const [openSection, setOpenSection] = useState<'scene' | 'style' | 'message' | null>(null);
  const [newScene, setNewScene] = useState('');
  const [newArtStyle, setNewArtStyle] = useState('ai_decide');
  const [newInsideDear, setNewInsideDear] = useState('');
  const [newInsideMessage, setNewInsideMessage] = useState('');
  const [newInsideFrom, setNewInsideFrom] = useState('');
  const [sceneEdited, setSceneEdited] = useState(false);
  const [styleEdited, setStyleEdited] = useState(false);
  const [messageEdited, setMessageEdited] = useState(false);

  // Regeneration type
  const [regenType, setRegenType] = useState<RegenType>('both');

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [mockCardNumber, setMockCardNumber] = useState('');
  const [mockExpiry, setMockExpiry] = useState('');
  const [mockCvc, setMockCvc] = useState('');
  const [payProcessing, setPayProcessing] = useState(false);

  // Post-payment confirmation state
  const [confirmPhase, setConfirmPhase] = useState(false);
  const [newCardId, setNewCardId] = useState<number | null>(null);
  const [newCardStatus, setNewCardStatus] = useState<'generating' | 'completed' | 'failed'>('generating');
  const [userEmail, setUserEmail] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const numericCardId = parseInt(cardId || '0');
  const regenPrice = REGEN_PRICES[regenType];
  const total = (PRINT_PRICE + regenPrice).toFixed(2);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/user')
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user?.id) setAuthStatus('authed');
        else setAuthStatus('otp-email');
      })
      .catch(() => setAuthStatus('otp-email'));
  }, []);

  // ── Load card data once authed ─────────────────────────────────────────────
  useEffect(() => {
    if (authStatus !== 'authed') return;
    fetch(`/api/cards/${numericCardId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setCardError('Card not found.'); return; }
        setCard(data);
        const conv = data.conversationData || {};
        setNewScene(conv.scene || '');
        setNewArtStyle(conv.art_style || 'ai_decide');
        const msg = conv.inside_message || {};
        if (typeof msg === 'object') {
          setNewInsideDear(msg.dear || '');
          setNewInsideMessage(msg.message || '');
          setNewInsideFrom(msg.from || '');
        } else if (typeof msg === 'string') {
          setNewInsideMessage(msg);
        }
        setUserEmail(conv.userEmail || conv.email || '');
        setCardLoading(false);
      })
      .catch(() => { setCardError('Failed to load card.'); setCardLoading(false); });
  }, [authStatus, numericCardId]);

  // ── Auto-select regenType based on edits ──────────────────────────────────
  useEffect(() => {
    if (sceneEdited && messageEdited) setRegenType('both');
    else if (sceneEdited) setRegenType('front');
    else if (messageEdited) setRegenType('inside');
    else setRegenType('both');
  }, [sceneEdited, messageEdited]);

  // ── Poll new card status in confirm phase ─────────────────────────────────
  useEffect(() => {
    if (!confirmPhase || !newCardId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/cards/${newCardId}/status`);
        const data = await res.json();
        if (data.status === 'completed') { setNewCardStatus('completed'); clearInterval(pollRef.current!); }
        else if (data.status === 'failed') { setNewCardStatus('failed'); clearInterval(pollRef.current!); }
      } catch {}
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [confirmPhase, newCardId]);

  // ── OTP flow ──────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!authEmail) return;
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail }),
      });
      if (res.ok) setAuthStatus('otp-code');
      else toast({ title: 'Error', description: 'Could not send code. Try again.', variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) return;
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, code: otpCode }),
      });
      const data = await res.json();
      if (data.success) { setUserEmail(authEmail); setAuthStatus('authed'); }
      else toast({ title: 'Invalid code', description: 'Check your email and try again.', variant: 'destructive' });
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Open payment modal ────────────────────────────────────────────────────
  const handleOpenPayModal = () => {
    const email = userEmail || card?.conversationData?.userEmail || card?.conversationData?.email || '';
    if (!email) {
      toast({ title: 'Email required', description: 'We need your email to send you the new card.', variant: 'destructive' });
      return;
    }
    setMockCardNumber('');
    setMockExpiry('');
    setMockCvc('');
    setShowPayModal(true);
  };

  // ── Execute payment (test mode — calls execute-regeneration directly) ──────
  const handlePay = async () => {
    const email = userEmail || card?.conversationData?.userEmail || card?.conversationData?.email || '';
    const insideMessageObj = { dear: newInsideDear, message: newInsideMessage, from: newInsideFrom };

    setPayProcessing(true);
    try {
      const body: any = {
        regenerateType: regenType,
        userEmail: email,
      };
      if (sceneEdited) body.newScene = newScene;
      if (styleEdited) body.newArtStyle = newArtStyle;
      if (messageEdited) body.newInsideMessage = JSON.stringify(insideMessageObj);

      const res = await fetch(`/api/cards/${numericCardId}/execute-regeneration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success && data.newCardId) {
        setNewCardId(data.newCardId);
        setShowPayModal(false);
        setConfirmPhase(true);
      } else {
        toast({ title: 'Error', description: data.message || 'Something went wrong.', variant: 'destructive' });
        setPayProcessing(false);
      }
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
      setPayProcessing(false);
    }
  };

  const convData = card?.conversationData || {};
  const recipientName = convData.name || 'your recipient';
  const celebration = convData.celebration || 'celebration';

  // ── Auth screen ───────────────────────────────────────────────────────────
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full" />
        </div>
        <Footer />
      </div>
    );
  }

  if (authStatus === 'otp-email' || authStatus === 'otp-code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="flex items-center justify-center min-h-[70vh] px-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
            <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign in to regenerate</h2>
            <p className="text-gray-500 text-sm mb-6">We'll send a quick code to your email.</p>
            {authStatus === 'otp-email' ? (
              <>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()} placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 mb-4" />
                <button onClick={handleSendOtp} disabled={authLoading || !authEmail}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {authLoading ? 'Sending...' : 'Send Code'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-purple-600 font-medium mb-4">Code sent to {authEmail}</p>
                <input type="text" value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()} placeholder="6-digit code"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-300 mb-4" />
                <button onClick={handleVerifyOtp} disabled={authLoading || otpCode.length < 6}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {authLoading ? 'Verifying...' : 'Verify'}
                </button>
                <button onClick={() => setAuthStatus('otp-email')} className="mt-3 text-sm text-gray-400 hover:text-gray-600">Back</button>
              </>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Confirmation / polling screen ─────────────────────────────────────────
  if (confirmPhase) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="flex items-center justify-center min-h-[70vh] px-4">
          <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
            {newCardStatus === 'generating' && (
              <>
                <div className="animate-spin w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Creating your new card ✨</h2>
                <p className="text-gray-500 text-sm">
                  {userEmail
                    ? <>We'll email you at <span className="font-semibold text-purple-600">{userEmail}</span> when it's ready.</>
                    : "Check your email — we'll send you a link when it's ready."}
                </p>
                <p className="text-gray-400 text-xs mt-4">This usually takes 1–2 minutes. You can safely close this page.</p>
              </>
            )}
            {newCardStatus === 'completed' && (
              <>
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Your new card is ready!</h2>
                <p className="text-gray-500 text-sm mb-6">Check your email for a link, or view it now.</p>
                <a href={`/card-preview/${newCardId}`}
                  className="inline-block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg hover:opacity-90 transition text-center">
                  View New Card →
                </a>
              </>
            )}
            {newCardStatus === 'failed' && (
              <>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Generation hit a snag</h2>
                <p className="text-gray-500 text-sm mb-6">Something went wrong generating your new card. Please get in touch and we'll sort it out.</p>
                <a href="/" className="inline-block w-full border-2 border-purple-200 text-purple-700 py-3 rounded-2xl font-semibold hover:bg-purple-50 transition">
                  Back to Home
                </a>
              </>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Loading / error ───────────────────────────────────────────────────────
  if (cardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full" />
        </div>
        <Footer />
      </div>
    );
  }

  if (cardError || !card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Card not found</h2>
            <p className="text-gray-500">{cardError}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Main regen page ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Page header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Order a new version</h1>
          <p className="text-gray-500">Tweak the scene, style, or message — then order your updated card.</p>
        </div>

        {/* Reference panel */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your current card</p>
          <p className="text-gray-700 font-medium mb-4">
            {recipientName}'s {celebration} card — use this as your reference
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium">Front</p>
              <img src={`/api/cards/${numericCardId}/fast-front-image`} alt="Card front"
                className="w-full h-auto rounded-xl shadow-md border border-gray-100" />
            </div>
            {card.insideImageUrl && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5 font-medium">Inside</p>
                <img src={`/api/cards/${numericCardId}/fast-inside-image`} alt="Card inside"
                  className="w-full h-auto rounded-xl shadow-md border border-gray-100" />
              </div>
            )}
          </div>
        </div>

        {/* Edit sections */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">What would you like to change?</p>

          {/* Scene & Setting */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setOpenSection(s => s === 'scene' ? null : 'scene')}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition">
              <span className="flex items-center gap-3">
                <Edit3 className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-gray-800">Scene &amp; Setting</span>
                {sceneEdited
                  ? <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Edited</span>
                  : <span className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Unchanged</span>}
              </span>
              {openSection === 'scene' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSection === 'scene' && (
              <div className="px-5 pb-5 border-t border-gray-50">
                <p className="text-xs text-gray-400 mt-3 mb-2">Describe the scene on the front of the card.</p>
                <textarea value={newScene}
                  onChange={e => { setNewScene(e.target.value); setSceneEdited(e.target.value !== (convData.scene || '')); }}
                  rows={4} placeholder="e.g. Hanging out in front of the Pyramids at sunset..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
              </div>
            )}
          </div>

          {/* Art Style */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setOpenSection(s => s === 'style' ? null : 'style')}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition">
              <span className="flex items-center gap-3">
                <Edit3 className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-gray-800">Art Style</span>
                {styleEdited
                  ? <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Edited</span>
                  : <span className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Unchanged</span>}
              </span>
              {openSection === 'style' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSection === 'style' && (
              <div className="px-5 pb-5 border-t border-gray-50">
                <p className="text-xs text-gray-400 mt-3 mb-3">Choose a different artistic style for the front.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ART_STYLES.map(s => (
                    <button key={s.value} onClick={() => { setNewArtStyle(s.value); setStyleEdited(s.value !== (convData.art_style || 'ai_decide')); }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition text-left ${newArtStyle === s.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Inside Message */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={() => setOpenSection(s => s === 'message' ? null : 'message')}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition">
              <span className="flex items-center gap-3">
                <Edit3 className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-gray-800">Inside Message</span>
                {messageEdited
                  ? <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Edited</span>
                  : <span className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Unchanged</span>}
              </span>
              {openSection === 'message' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {openSection === 'message' && (
              <div className="px-5 pb-5 border-t border-gray-50 space-y-3 mt-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Dear...</label>
                  <input value={newInsideDear} onChange={e => { setNewInsideDear(e.target.value); setMessageEdited(true); }}
                    placeholder="e.g. Mum" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Message</label>
                  <textarea value={newInsideMessage} onChange={e => { setNewInsideMessage(e.target.value); setMessageEdited(true); }}
                    rows={4} placeholder="Write your heartfelt message here..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">From</label>
                  <input value={newInsideFrom} onChange={e => { setNewInsideFrom(e.target.value); setMessageEdited(true); }}
                    placeholder="e.g. Your loving family" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Regen type selector */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">What gets regenerated?</p>
          <div className="space-y-2">
            {([
              { value: 'front' as RegenType, label: 'Front design only', price: `+£${REGEN_PRICES.front.toFixed(2)}`, hint: 'New scene & art style' },
              { value: 'inside' as RegenType, label: 'Inside message only', price: `+£${REGEN_PRICES.inside.toFixed(2)}`, hint: 'New message design' },
              { value: 'both' as RegenType, label: 'Front + inside', price: `+£${REGEN_PRICES.both.toFixed(2)}`, hint: 'Full refresh' },
            ] as const).map(opt => (
              <label key={opt.value}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition ${regenType === opt.value ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-purple-200'}`}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="regenType" value={opt.value} checked={regenType === opt.value}
                    onChange={() => setRegenType(opt.value)} className="text-purple-600" />
                  <span>
                    <span className="font-medium text-gray-800 text-sm">{opt.label}</span>
                    <span className="text-xs text-gray-400 ml-2">{opt.hint}</span>
                  </span>
                </span>
                <span className={`text-sm font-bold ${regenType === opt.value ? 'text-purple-600' : 'text-gray-400'}`}>{opt.price}</span>
              </label>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Printed card + {REGEN_LABELS[regenType].toLowerCase()}</p>
              <p className="text-xs text-gray-500 mt-0.5">Your original card is never overwritten</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-700">£{total}</p>
              <p className="text-xs text-gray-400">inc. VAT</p>
            </div>
          </div>
          <button onClick={handleOpenPayModal}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95">
            Order new version — £{total}
          </button>
          <p className="text-xs text-center text-gray-400 mt-3">You'll receive a link to your new card by email</p>
        </div>
      </main>

      <Footer />

      {/* ── Payment Modal ─────────────────────────────────────────────────────── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Test mode banner */}
            <div className="bg-amber-400 px-5 py-2.5 flex items-center gap-2">
              <span className="text-amber-900 text-sm font-bold">🧪 TEST MODE</span>
              <span className="text-amber-800 text-xs">No payment is processed</span>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Order a new version</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ordering a printed copy of your new {recipientName} card
                </p>
              </div>
              <button onClick={() => setShowPayModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition ml-4 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price breakdown */}
            <div className="mx-6 mb-5 bg-gray-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Printed card (5″×5″, front &amp; inside)</span>
                <span className="font-medium text-gray-800">£{PRINT_PRICE.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{REGEN_LABELS[regenType]}</span>
                <span className="font-medium text-gray-800">+£{regenPrice.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-purple-700 text-lg">£{total}</span>
              </div>
            </div>

            {/* Mock card form */}
            <div className="px-6 mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Card details
              </p>
              <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                <input
                  value={mockCardNumber}
                  onChange={e => setMockCardNumber(formatCard(e.target.value))}
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                  className="w-full px-4 py-3 text-sm text-gray-800 focus:outline-none focus:bg-purple-50/30 placeholder-gray-300 font-mono"
                />
                <div className="flex divide-x divide-gray-100">
                  <input
                    value={mockExpiry}
                    onChange={e => setMockExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    inputMode="numeric"
                    className="flex-1 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:bg-purple-50/30 placeholder-gray-300 font-mono"
                  />
                  <input
                    value={mockCvc}
                    onChange={e => setMockCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="CVC"
                    inputMode="numeric"
                    className="w-28 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:bg-purple-50/30 placeholder-gray-300 font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-2.5 text-gray-400">
                <Lock className="w-3 h-3" />
                <span className="text-xs">Secured by Stripe</span>
              </div>
            </div>

            {/* Pay button */}
            <div className="px-6 pb-6">
              <button onClick={handlePay} disabled={payProcessing}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 disabled:opacity-60 text-white py-4 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                {payProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Pay £{total} (Test Mode)</>
                )}
              </button>
              <p className="text-xs text-center text-gray-400 mt-3">
                In test mode, no charge is made. Add your Stripe key to go live.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
