import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Edit, Download, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { emergencyStorageCleanup } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CardPreviewProps {
  card: any;
  onboarding: any;
}

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

export default function CardPreview({ card, onboarding }: CardPreviewProps) {
  const [, setLocation] = useLocation();
  const [currentView, setCurrentView] = useState<'front' | 'inside' | 'open'>('front');
  const [downloading, setDownloading] = useState<'front' | 'inside' | null>(null);
  const { toast } = useToast();

  // Regeneration state
  const [showTweakPanel, setShowTweakPanel] = useState(false);
  const [regenType, setRegenType] = useState<'front' | 'inside' | 'both'>('front');
  const convData = card.conversationData || {};
  const [newScene, setNewScene] = useState(convData.scene || '');
  const [newArtStyle, setNewArtStyle] = useState(convData.art_style || 'ai_decide');
  const [newInsideMessage, setNewInsideMessage] = useState(convData.inside_message || '');
  const [regenSubmitting, setRegenSubmitting] = useState(false);
  const [regenComplete, setRegenComplete] = useState(false);

  // Detect post-payment redirect for regeneration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const regenRef = params.get('regen_ref');
    const regenTypeParam = params.get('regen_type') as 'front' | 'inside' | 'both' | null;
    if (regenRef && regenTypeParam) {
      const userEmail = convData.userEmail || convData.email || '';
      setRegenSubmitting(true);
      fetch(`/api/cards/${card.id}/execute-regeneration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paystackReference: regenRef,
          regenerateType: regenTypeParam,
          userEmail,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setRegenComplete(true);
            toast({ title: 'Regeneration started!', description: 'Check your email when your new card is ready.' });
          } else {
            toast({ title: 'Regeneration error', description: data.message || 'Something went wrong.', variant: 'destructive' });
          }
        })
        .catch(() => toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' }))
        .finally(() => {
          setRegenSubmitting(false);
          // Clean up URL params without full reload
          const url = new URL(window.location.href);
          url.searchParams.delete('regen_ref');
          url.searchParams.delete('regen_type');
          window.history.replaceState({}, '', url.toString());
        });
    }
  }, []);

  const handleInitiateRegeneration = async () => {
    const userEmail = convData.userEmail || convData.email || '';
    if (!userEmail) {
      toast({ title: 'Email required', description: 'We need your email to send you the regenerated card.', variant: 'destructive' });
      return;
    }
    setRegenSubmitting(true);
    try {
      const res = await fetch(`/api/cards/${card.id}/initiate-regeneration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, regenerateType: regenType, newScene, newArtStyle, newInsideMessage }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.testMode) {
        toast({ title: 'Test mode', description: 'No Paystack key configured — regeneration skipped in test mode.' });
        setRegenSubmitting(false);
      } else {
        toast({ title: 'Payment error', description: data.message || 'Could not start payment.', variant: 'destructive' });
        setRegenSubmitting(false);
      }
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
      setRegenSubmitting(false);
    }
  };

  const handleDownload = async (type: 'front' | 'inside') => {
    setDownloading(type);
    try {
      const url = `/api/cards/${card.id}/fast-${type}-image`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `celebrait-card-${type}-${card.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast({ title: 'Download failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  // Reset view to 'front' if 'open' is selected but card is digital
  useEffect(() => {
    if (currentView === 'open' && card.cardType === 'digital') {
      setCurrentView('front');
    }
  }, [currentView, card.cardType]);

  // Preload data for instant delivery details loading
  useEffect(() => {
    if (card && onboarding) {
      const preloadData = async () => {
        try {
          // Create comprehensive cache for instant loading
          const fullCardData = {
            id: card.id,
            cardType: card.cardType,
            price: card.price,
            conversationData: card.conversationData || onboarding
          };
          
          // Cache with multiple keys for maximum hit rate
          sessionStorage.setItem('cardPreviewData', JSON.stringify(fullCardData));
          sessionStorage.setItem(`card_${card.id}`, JSON.stringify(fullCardData));
          
          // Preload recipient name for instant personalization
          const recipientName = onboarding.answers?.name || 
                               onboarding.name || 
                               card.conversationData?.name ||
                               card.conversationData?.recipient_name ||
                               card.conversationData?.recipientName;
          
          if (recipientName && recipientName !== 'the recipient') {
            sessionStorage.setItem('recipientName', recipientName);
            // Ensure the name is available in onboarding.answers for title personalization
            if (!onboarding.answers?.name && recipientName) {
              onboarding.setAnswers({
                ...onboarding.answers,
                name: recipientName,
                celebration: onboarding.answers?.celebration || card.conversationData?.celebration
              });
            }
            console.log('[INSTANT] Preloaded recipient name:', recipientName);
          }
          
          console.log('[INSTANT] Preloaded delivery details data for zero-loading experience');
        } catch (e) {
          console.warn('Preload failed:', e);
        }
      };
      
      preloadData();
    }
  }, [card, onboarding]);

  const handleChooseDelivery = () => {
    // Emergency storage cleanup before navigation to prevent quota errors
    const cleanupSuccess = emergencyStorageCleanup();
    
    // Store minimal card data only
    const minimalCardData = {
      id: card.id,
      cardType: card.cardType,
      price: card.price,
      frontImageUrl: card.frontImageUrl,
      insideImageUrl: card.insideImageUrl
    };
    
    try {
      sessionStorage.setItem('cardPreviewData', JSON.stringify(minimalCardData));
    } catch (e) {
      console.warn('Could not store card data, clearing more storage:', e);
      // If storage fails, clear everything and try again
      try {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('cardPreviewData', JSON.stringify(minimalCardData));
      } catch (e2) {
        console.error('Storage completely full:', e2);
      }
    }
    
    // Digital-only launch: Skip delivery choice and go directly to complete order
    // Store digital delivery type selection
    sessionStorage.setItem('selectedDeliveryType', 'digital');
    
    // Scroll to top and add fade transition to content area only
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const contentArea = document.querySelector('.fade-transition-content');
    if (contentArea) {
      (contentArea as HTMLElement).style.opacity = '0.8';
    }
    
    setTimeout(() => {
      try {
        // Digital-only launch: Go directly to complete order page
        console.log('[DIGITAL-ONLY] Going to complete order page');
        setLocation(`/complete-order/${card.id}?type=digital`);
        setTimeout(() => {
          const newContentArea = document.querySelector('.fade-transition-content');
          if (newContentArea) {
            (newContentArea as HTMLElement).style.opacity = '1';
          }
        }, 100);
      } catch (error) {
        console.error('Navigation failed:', error);
        // Force page reload as fallback
        window.location.href = `/complete-order/${card.id}?type=digital`;
        setTimeout(() => {
          const newContentArea = document.querySelector('.fade-transition-content');
          if (newContentArea) {
            (newContentArea as HTMLElement).style.opacity = '1';
          }
        }, 100);
      }
    }, 150);
  };

  const handleTryAgain = () => {
    onboarding.setCurrentStep(3);
    window.location.reload();
  };

  const handleEdit = () => {
    onboarding.setCurrentStep(3);
  };





  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 fade-transition-content">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          {(() => {
            const recipientName = onboarding.answers?.name || card.conversationData?.name;
            const celebration = onboarding.answers?.celebration || card.conversationData?.celebration || 'celebration';
            return recipientName ? `${recipientName}'s ${celebration} card is ready ✨` : `Your ${celebration} card is ready ✨`;
          })()}
        </h2>
      </div>

      {/* Card Display with Toggle Options */}
      <div className="mb-8">
        {/* Three Toggle Options */}
        <div className="flex justify-center mb-6 space-x-2 bg-gray-100 p-1 rounded-2xl max-w-fit mx-auto">
          <button
            onClick={() => setCurrentView('front')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              currentView === 'front'
                ? 'bg-white text-purple-600 shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Front Design
          </button>
          {card.insideImageUrl && (
            <button
              onClick={() => setCurrentView('inside')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentView === 'inside'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Inside Design
            </button>
          )}
          {card.insideImageUrl && card.cardType === 'printed' && (
            <button
              onClick={() => setCurrentView('open')}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentView === 'open'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Open Card
            </button>
          )}
        </div>

        {/* Card Display Area */}
        <div className="w-full flex justify-center">
          <div className="transition-all duration-300 ease-in-out max-w-2xl">
            {currentView === 'front' && (
              <div className="w-full">
                <img 
                  src={`/api/cards/${card.id}/fast-front-image`}
                  alt="Card Front Design"
                  className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
                />
              </div>
            )}
            
            {currentView === 'inside' && card.insideImageUrl && (
              <div className="w-full">
                <img 
                  src={`/api/cards/${card.id}/fast-inside-image`}
                  alt="Card Inside Design"
                  className="w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
                />
              </div>
            )}
            
            {currentView === 'open' && card.insideImageUrl && card.cardType === 'printed' && (
              <div className="w-full">
                <div className="flex bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                  {/* Left side - blank */}
                  <div className="w-1/2 bg-gray-50 aspect-square flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Inside Left</p>
                  </div>
                  {/* Right side - inside image */}
                  <div className="w-1/2">
                    <img 
                      src={`/api/cards/${card.id}/fast-inside-image`}
                      alt="Card Inside Design"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing clarity */}
      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-3 text-center">
          <p className="text-purple-700 font-bold text-sm">Digital card</p>
          <p className="text-purple-600 text-xs mt-0.5">Free download</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-3 text-center">
          <p className="text-purple-700 font-bold text-sm">Printed card</p>
          <p className="text-purple-600 text-xs mt-0.5">From R129</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-3 text-center">
          <p className="text-purple-700 font-bold text-sm">Regenerate</p>
          <p className="text-purple-600 text-xs mt-0.5">From R25</p>
        </div>
      </div>

      {/* Download buttons */}
      <div className="flex gap-3 max-w-lg mx-auto mb-4">
        <button
          onClick={() => handleDownload('front')}
          disabled={downloading === 'front'}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 py-3 rounded-2xl font-medium transition-all duration-200 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {downloading === 'front' ? 'Saving...' : 'Save Front'}
        </button>
        {card.insideImageUrl && (
          <button
            onClick={() => handleDownload('inside')}
            disabled={downloading === 'inside'}
            className="flex-1 flex items-center justify-center gap-2 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 py-3 rounded-2xl font-medium transition-all duration-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading === 'inside' ? 'Saving...' : 'Save Inside'}
          </button>
        )}
      </div>

      {/* Order printed card */}
      <div className="max-w-lg mx-auto">
        <Button
          onClick={handleChooseDelivery}
          className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
        >
          Order Printed Card — R129
        </Button>
      </div>

      {/* Tweak & Regenerate panel */}
      <div className="max-w-lg mx-auto mt-4">
        {regenComplete ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <Sparkles className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-semibold">Regeneration underway!</p>
            <p className="text-green-700 text-sm mt-1">We'll email you as soon as your new card is ready.</p>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowTweakPanel(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-gray-700 font-medium transition-all duration-200"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Not quite right? Tweak &amp; Regenerate
              </span>
              {showTweakPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTweakPanel && (
              <div className="mt-3 bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
                <p className="text-sm text-gray-500">Change anything below and we'll create a fresh version for you.</p>

                {/* Scene */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Scene description</label>
                  <textarea
                    value={newScene}
                    onChange={e => setNewScene(e.target.value)}
                    rows={3}
                    placeholder="Describe the scene on the front of the card..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                  />
                </div>

                {/* Art style */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Art style</label>
                  <select
                    value={newArtStyle}
                    onChange={e => setNewArtStyle(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    {ART_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Inside message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Inside message</label>
                  <textarea
                    value={newInsideMessage}
                    onChange={e => setNewInsideMessage(e.target.value)}
                    rows={3}
                    placeholder="The message printed inside the card..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                  />
                </div>

                {/* Regeneration type + pricing */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">What to regenerate</label>
                  <div className="space-y-2">
                    {[
                      { value: 'front', label: 'Front design only', price: 'R25' },
                      { value: 'inside', label: 'Inside message only', price: 'R15' },
                      { value: 'both', label: 'Front + inside', price: 'R35' },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                          regenType === opt.value
                            ? 'border-purple-400 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-200'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="regenType"
                            value={opt.value}
                            checked={regenType === opt.value}
                            onChange={() => setRegenType(opt.value as any)}
                            className="accent-purple-600"
                          />
                          <span className="text-sm text-gray-800">{opt.label}</span>
                        </span>
                        <span className="text-sm font-semibold text-purple-700">{opt.price}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleInitiateRegeneration}
                  disabled={regenSubmitting}
                  className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-60"
                >
                  {regenSubmitting ? 'Redirecting to payment...' : `Pay & Regenerate — ${regenType === 'front' ? 'R25' : regenType === 'inside' ? 'R15' : 'R35'}`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
