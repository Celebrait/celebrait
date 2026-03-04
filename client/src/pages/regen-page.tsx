import { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, Sparkles, CheckCircle, Edit3 } from 'lucide-react';

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

type RegenType = 'front' | 'inside' | 'both';

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
  const [paying, setPaying] = useState(false);

  // Post-payment confirmation state
  const [confirmPhase, setConfirmPhase] = useState(false);
  const [newCardId, setNewCardId] = useState<number | null>(null);
  const [newCardStatus, setNewCardStatus] = useState<'generating' | 'completed' | 'failed'>('generating');
  const [userEmail, setUserEmail] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const numericCardId = parseInt(cardId || '0');

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/user')
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user?.id) {
          setAuthStatus('authed');
        } else {
          setAuthStatus('otp-email');
        }
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

  // ── Detect post-payment redirect ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const regenRef = params.get('regen_ref');
    const regenTypeParam = params.get('regen_type') as RegenType | null;
    if (!regenRef || !regenTypeParam) return;

    // Read saved edits from sessionStorage
    let savedEdits: any = {};
    try {
      const stored = sessionStorage.getItem(`regen_edits_${numericCardId}`);
      if (stored) savedEdits = JSON.parse(stored);
    } catch {}

    const execRegen = async () => {
      // Need auth first — wait a moment then execute
      const execEmail = savedEdits.userEmail || userEmail;

      const body: any = {
        paystackReference: regenRef,
        regenerateType: regenTypeParam,
        userEmail: execEmail,
      };
      if (savedEdits.newScene) body.newScene = savedEdits.newScene;
      if (savedEdits.newArtStyle) body.newArtStyle = savedEdits.newArtStyle;
      if (savedEdits.newInsideMessage !== undefined) body.newInsideMessage = savedEdits.newInsideMessage;

      try {
        const res = await fetch(`/api/cards/${numericCardId}/execute-regeneration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success && data.newCardId) {
          setNewCardId(data.newCardId);
          setConfirmPhase(true);
          // Clean up URL
          const url = new URL(window.location.href);
          url.searchParams.delete('regen_ref');
          url.searchParams.delete('regen_type');
          window.history.replaceState({}, '', url.toString());
        } else {
          toast({ title: 'Regeneration error', description: data.message || 'Something went wrong.', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
      }
    };

    // Small delay to allow card data + user email to load
    const timer = setTimeout(execRegen, 1000);
    return () => clearTimeout(timer);
  }, [numericCardId]);

  // ── Poll new card status in confirm phase ─────────────────────────────────
  useEffect(() => {
    if (!confirmPhase || !newCardId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/cards/${newCardId}/status`);
        const data = await res.json();
        if (data.status === 'completed') {
          setNewCardStatus('completed');
          clearInterval(pollRef.current!);
        } else if (data.status === 'failed') {
          setNewCardStatus('failed');
          clearInterval(pollRef.current!);
        }
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
      if (res.ok) {
        setAuthStatus('otp-code');
      } else {
        toast({ title: 'Error', description: 'Could not send code. Try again.', variant: 'destructive' });
      }
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
      if (data.success) {
        setUserEmail(authEmail);
        setAuthStatus('authed');
      } else {
        toast({ title: 'Invalid code', description: 'Check your email and try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Pay & Regenerate ──────────────────────────────────────────────────────
  const handlePay = async () => {
    const email = userEmail || card?.conversationData?.userEmail || card?.conversationData?.email || '';
    if (!email) {
      toast({ title: 'Email required', description: 'We need your email to send you the new card.', variant: 'destructive' });
      return;
    }

    // Build inside_message object
    const insideMessageObj = {
      dear: newInsideDear,
      message: newInsideMessage,
      from: newInsideFrom,
    };

    // Save edits to sessionStorage before redirect
    const edits = {
      userEmail: email,
      newScene: sceneEdited ? newScene : undefined,
      newArtStyle: styleEdited ? newArtStyle : undefined,
      newInsideMessage: messageEdited ? JSON.stringify(insideMessageObj) : undefined,
    };
    sessionStorage.setItem(`regen_edits_${numericCardId}`, JSON.stringify(edits));

    setPaying(true);
    try {
      const res = await fetch(`/api/cards/${numericCardId}/initiate-regeneration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          regenerateType: regenType,
          newScene: sceneEdited ? newScene : undefined,
          newArtStyle: styleEdited ? newArtStyle : undefined,
          newInsideMessage: messageEdited ? JSON.stringify(insideMessageObj) : undefined,
        }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.testMode) {
        toast({ title: 'Test mode', description: 'No payment configured — regen skipped.' });
        setPaying(false);
      } else {
        toast({ title: 'Payment error', description: data.message || 'Could not start payment.', variant: 'destructive' });
        setPaying(false);
      }
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
      setPaying(false);
    }
  };

  const priceLabel = regenType === 'front' ? 'R25' : regenType === 'inside' ? 'R15' : 'R35';

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
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 mb-4"
                />
                <button
                  onClick={handleSendOtp}
                  disabled={authLoading || !authEmail}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {authLoading ? 'Sending...' : 'Send Code'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-purple-600 font-medium mb-4">Code sent to {authEmail}</p>
                <input
                  type="text"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                  placeholder="6-digit code"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-300 mb-4"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={authLoading || otpCode.length < 6}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {authLoading ? 'Verifying...' : 'Verify'}
                </button>
                <button onClick={() => setAuthStatus('otp-email')} className="mt-3 text-sm text-gray-400 hover:text-gray-600">
                  Back
                </button>
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
                <a
                  href={`/card-preview/${newCardId}`}
                  className="inline-block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg hover:opacity-90 transition"
                >
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
                <a
                  href="/"
                  className="inline-block w-full border-2 border-purple-200 text-purple-700 py-3 rounded-2xl font-semibold hover:bg-purple-50 transition"
                >
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Regenerate your card</h1>
          <p className="text-gray-500">Edit what you want to change, then pay to create a fresh version.</p>
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
              <img
                src={`/api/cards/${numericCardId}/fast-front-image`}
                alt="Card front"
                className="w-full h-auto rounded-xl shadow-md border border-gray-100"
              />
            </div>
            {card.insideImageUrl && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5 font-medium">Inside</p>
                <img
                  src={`/api/cards/${numericCardId}/fast-inside-image`}
                  alt="Card inside"
                  className="w-full h-auto rounded-xl shadow-md border border-gray-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Edit sections */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">What would you like to change?</p>

          {/* Section: Scene & Setting */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenSection(s => s === 'scene' ? null : 'scene')}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
            >
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
                <p className="text-xs text-gray-400 mt-3 mb-2">Describe the scene on the front of the card — location, mood, what's happening.</p>
                <textarea
                  value={newScene}
                  onChange={e => { setNewScene(e.target.value); setSceneEdited(e.target.value !== (convData.scene || '')); }}
                  rows={4}
                  placeholder="e.g. Hanging out in front of the Pyramids at sunset..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                />
              </div>
            )}
          </div>

          {/* Section: Art Style */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenSection(s => s === 'style' ? null : 'style')}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
            >
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
                <p className="text-xs text-gray-400 mt-3 mb-3">Choose a different visual style for the card artwork.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ART_STYLES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => { setNewArtStyle(s.value); setStyleEdited(s.value !== (convData.art_style || 'ai_decide')); }}
                      className={`text-sm px-3 py-2.5 rounded-xl border-2 font-medium transition-all ${
                        newArtStyle === s.value
                          ? 'border-purple-400 bg-purple-50 text-purple-700'
                          : 'border-gray-200 text-gray-600 hover:border-purple-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Inside Message */}
          {card.insideImageUrl && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenSection(s => s === 'message' ? null : 'message')}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
              >
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
                <div className="px-5 pb-5 border-t border-gray-50 space-y-3">
                  <p className="text-xs text-gray-400 mt-3">Edit the personal message inside the card.</p>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Dear...</label>
                    <input
                      type="text"
                      value={newInsideDear}
                      onChange={e => { setNewInsideDear(e.target.value); setMessageEdited(true); }}
                      placeholder="e.g. Aidan"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">Message</label>
                    <textarea
                      value={newInsideMessage}
                      onChange={e => { setNewInsideMessage(e.target.value); setMessageEdited(true); }}
                      rows={4}
                      placeholder="Write your heartfelt message..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">From</label>
                    <input
                      type="text"
                      value={newInsideFrom}
                      onChange={e => { setNewInsideFrom(e.target.value); setMessageEdited(true); }}
                      placeholder="e.g. The whole team"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Regeneration type selector */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">What should we regenerate?</p>
          <div className="space-y-2">
            {[
              { value: 'front' as RegenType, label: 'Front design only', price: 'R25', hint: 'New scene & art style' },
              { value: 'inside' as RegenType, label: 'Inside message only', price: 'R15', hint: 'New message design' },
              { value: 'both' as RegenType, label: 'Front + inside', price: 'R35', hint: 'Full refresh' },
            ].map(opt => (
              <label
                key={opt.value}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  regenType === opt.value
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-200'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="regenType"
                    value={opt.value}
                    checked={regenType === opt.value}
                    onChange={() => setRegenType(opt.value)}
                    className="accent-purple-600"
                  />
                  <span>
                    <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                    <span className="block text-xs text-gray-400">{opt.hint}</span>
                  </span>
                </span>
                <span className="text-sm font-bold text-purple-700">{opt.price}</span>
              </label>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all disabled:opacity-60"
        >
          {paying ? 'Redirecting to payment...' : `Pay ${priceLabel} & Regenerate`}
        </button>
        <p className="text-center text-xs text-gray-400 mt-3">
          Your original card is safe — this creates a brand new version.
        </p>

        {/* Back link */}
        <div className="text-center mt-6">
          <a href={`/card-preview/${numericCardId}`} className="text-sm text-gray-400 hover:text-gray-600 transition">
            ← Back to original card
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
