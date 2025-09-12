import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, RefreshCw, Info } from "lucide-react";

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
}

const safetyCategories: SafetyIssue[] = [
  {
    category: "Children in Photos",
    description: "Our AI safety system sometimes flags uploaded images containing children as a precautionary measure.",
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
    description: "Sometimes our AI safety system flags content for reasons that aren't immediately clear. This can happen with perfectly innocent content.",
    solution: "Try slightly rewording your description or uploading a different photo. The detection can be inconsistent.",
    riskLevel: "low",
    examples: ["Technical glitches", "False positives", "Overly cautious filtering"]
  }
];

const getRiskColor = (level: 'low' | 'medium' | 'high') => {
  switch (level) {
    case 'low': return 'text-yellow-600';
    case 'medium': return 'text-orange-600';
    case 'high': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

const getRiskBadge = (level: 'low' | 'medium' | 'high') => {
  const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
  switch (level) {
    case 'low': return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case 'medium': return `${baseClasses} bg-orange-100 text-orange-800`;
    case 'high': return `${baseClasses} bg-red-100 text-red-800`;
    default: return `${baseClasses} bg-gray-100 text-gray-800`;
  }
};

export function SafetyGuideModal({ isOpen, onClose, onRetry, detectedIssues }: SafetyGuideModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="modal-safety-guide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-blue-600" />
            AI Safety Check Triggered
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            Our AI safety system has flagged your content. Don't worry - this happens occasionally! 
            Here's what might have caused it and how to fix it:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {safetyCategories.map((issue, index) => (
            <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  {issue.category}
                </h4>
                <span className={getRiskBadge(issue.riskLevel)}>
                  {issue.riskLevel} risk
                </span>
              </div>
              
              <p className="text-gray-700 mb-3 text-sm">
                {issue.description}
              </p>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3">
                <p className="text-blue-800 font-medium text-sm">
                  <strong>Solution:</strong> {issue.solution}
                </p>
              </div>

              {issue.examples && (
                <div className="text-xs text-gray-500">
                  <strong>Examples:</strong> {issue.examples.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t pt-4 mt-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Good News!</span>
            </div>
            <p className="text-green-700 text-sm">
              Most safety flags are temporary and resolve with small adjustments. 
              The majority of users succeed on their second attempt.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              data-testid="button-close-safety-modal"
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                onRetry();
                onClose();
              }}
              className="bg-blue-600 hover:bg-blue-700"
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