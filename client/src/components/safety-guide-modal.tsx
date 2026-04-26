import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { AlertTriangle, Shield, RefreshCw, Info, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface SafetyIssue {
  category: string;
  description: string;
  solution: string;
  riskLevel: 'low' | 'medium' | 'high';
  examples?: string[];
}

interface SafetyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  detectedIssues?: string[];
  errorTitle?: string;
  errorMessage?: string;
  errorKind?: 'safety' | 'auth' | 'rate' | 'server' | 'invalid';
  errorCode?: string;
}

const safetyCategories: SafetyIssue[] = [
  {
    category: "Children in Photos",
    description: "Our content checks sometimes flag uploaded images containing children as a precautionary measure.",
    solution: "Try uploading a different photo - you'll likely get through on the next attempt. This is a temporary safety check.",
    riskLevel: "low",
    examples: ["Family photos", "Kids at parties", "School events"]
  },
  {
    category: "Explicit Language",
    description: "Strong language or inappropriate content in your message is consistently flagged by our safety systems.",
    solution: "Please rephrase your message using family-friendly language. Consider alternatives to strong words.",
    riskLevel: "high",
    examples: ["Swear words", "Offensive terms", "Adult humor", "Inappropriate jokes"]
  },
  {
    category: "Adult Content",
    description: "Any content of an adult or suggestive nature is not permitted on our platform.",
    solution: "Please remove any adult themes, suggestive content, or mature references from your card description.",
    riskLevel: "high",
    examples: ["Suggestive imagery", "Adult themes", "Mature content", "Inappropriate scenes"]
  },
  {
    category: "Copyrighted Content",
    description: "References to specific brands, characters, or copyrighted material are sometimes flagged to protect intellectual property.",
    solution: "Try describing your scene without mentioning specific brand names, character names, or copyrighted properties.",
    riskLevel: "medium",
    examples: ["Disney characters", "Marvel/DC heroes", "Brand logos", "Movie characters", "TV show references"]
  },
  {
    category: "Unclear Detection",
    description: "Sometimes our content checks flag things for reasons that aren't immediately clear. This can happen with perfectly innocent content.",
    solution: "Try slightly rewording your description or uploading a different photo. The detection can be inconsistent.",
    riskLevel: "low",
    examples: ["Technical glitches", "False positives", "Overly cautious filtering"]
  }
];

const getRiskColor = (level: 'low' | 'medium' | 'high') => {
  switch (level) {
    case 'low': return 'text-emerald-600';
    case 'medium': return 'text-amber-600';
    case 'high': return 'text-rose-600';
    default: return 'text-purple-600';
  }
};

const getRiskBadge = (level: 'low' | 'medium' | 'high') => {
  const baseClasses = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold";
  switch (level) {
    case 'low': return `${baseClasses} bg-emerald-100 text-emerald-700 border border-emerald-200`;
    case 'medium': return `${baseClasses} bg-amber-100 text-amber-700 border border-amber-200`;
    case 'high': return `${baseClasses} bg-rose-100 text-rose-700 border border-rose-200`;
    default: return `${baseClasses} bg-purple-100 text-purple-700 border border-purple-200`;
  }
};

export function SafetyGuideModal({ 
  isOpen, 
  onClose, 
  onRetry, 
  detectedIssues, 
  errorTitle, 
  errorMessage, 
  errorKind, 
  errorCode 
}: SafetyGuideModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50" data-testid="modal-safety-guide">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {errorTitle || "Hold on — something flagged"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-base text-gray-700 ml-15">
            {errorMessage || "Something in your content was flagged by our safety checks. Don't worry — it happens. Here's what might have caused it and how to fix it:"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto pr-2">
          {/* Show enhanced error info if available */}
          {errorKind && errorCode && (
            <div className="bg-white/60 backdrop-blur-sm border border-purple-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-gray-900">Error Details</span>
              </div>
              <div className="text-sm text-gray-700">
                <p><strong>Type:</strong> {errorKind}</p>
                <p><strong>Code:</strong> {errorCode}</p>
              </div>
            </div>
          )}
          
          {/* Show safety guidance only for safety errors or when no specific error kind */}
          {(!errorKind || errorKind === 'safety') && (
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Safety Guidelines ({currentSlide + 1} of {safetyCategories.length})
                </h3>
                <div className="flex gap-1">
                  {safetyCategories.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentSlide 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              <Carousel className="w-full" opts={{ startIndex: currentSlide }}>
                <CarouselContent>
                  {safetyCategories.map((issue, index) => (
                    <CarouselItem key={index}>
                      <div className="bg-white/70 backdrop-blur-sm border-2 border-transparent bg-clip-padding rounded-xl p-6 shadow-lg relative overflow-hidden">
                        {/* Gradient border effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl -z-10 p-[2px]">
                          <div className="w-full h-full bg-white/70 backdrop-blur-sm rounded-[10px]"></div>
                        </div>
                        
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                              <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            {issue.category}
                          </h4>
                          <span className={getRiskBadge(issue.riskLevel)}>
                            {issue.riskLevel} risk
                          </span>
                        </div>
                        
                        <p className="text-gray-700 mb-4 text-base leading-relaxed">
                          {issue.description}
                        </p>
                        
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-gradient-to-b from-purple-400 to-pink-400 rounded-r-lg p-4 mb-4">
                          <p className="text-purple-800 font-semibold text-sm">
                            <strong className="text-purple-900">💡 Solution:</strong> {issue.solution}
                          </p>
                        </div>

                        {issue.examples && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-600 mb-1">Common Examples:</p>
                            <p className="text-xs text-gray-500">{issue.examples.join(" • ")}</p>
                          </div>
                        )}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious 
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none hover:from-purple-600 hover:to-pink-600"
                  onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                />
                <CarouselNext 
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none hover:from-purple-600 hover:to-pink-600"
                  onClick={() => setCurrentSlide(Math.min(safetyCategories.length - 1, currentSlide + 1))}
                />
              </Carousel>
            </div>
          )}
          
          {/* Show different guidance for non-safety errors */}
          {errorKind && errorKind !== 'safety' && (
            <div className="bg-white/60 backdrop-blur-sm border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-purple-600" />
                <span className="font-semibold text-purple-900">What to try next:</span>
              </div>
              <div className="text-sm text-purple-800">
                {errorKind === 'rate' && (
                  <p>Wait a few moments and try again. We're a bit busy right now.</p>
                )}
                {errorKind === 'auth' && (
                  <p>There's an authentication issue on our side. Please contact support if it keeps happening.</p>
                )}
                {errorKind === 'server' && (
                  <p>We're having technical difficulties. Please try again in a few moments.</p>
                )}
                {errorKind === 'invalid' && (
                  <p>Please check your input and try making small adjustments to your request.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-purple-200 pt-6 mt-6">
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-emerald-800">Good News!</span>
            </div>
            <p className="text-emerald-700 text-sm font-medium">
              Most safety flags are temporary and resolve with small adjustments. 
              The majority of users succeed on their second attempt.
            </p>
          </div>

          <div className="flex gap-4 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 px-6 py-2 font-semibold"
              data-testid="button-close-safety-modal"
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                onRetry();
                onClose();
              }}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              data-testid="button-try-again"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}