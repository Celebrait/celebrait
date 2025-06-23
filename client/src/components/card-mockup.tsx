
import { useState } from "react";

interface CardMockupProps {
  frontImageUrl?: string;
  insideImageUrl?: string;
  currentView: 'front' | 'inside';
  showDimensions?: boolean;
}

export default function CardMockup({ 
  frontImageUrl, 
  insideImageUrl, 
  currentView, 
  showDimensions = true 
}: CardMockupProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="relative">
      {/* Card dimensions label */}
      {showDimensions && (
        <div className="text-center mb-4">
          <span className="inline-block bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
            5" × 5" Greeting Card
          </span>
        </div>
      )}

      {/* Card mockup container */}
      <div className="relative max-w-lg mx-auto">
        {/* 3D perspective shadow */}
        <div className="absolute inset-0 bg-black/10 rounded-lg transform translate-x-1 translate-y-1 blur-sm" />
        
        {/* Main card container */}
        <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          {/* Card content area */}
          <div className="relative aspect-square p-3">
            {/* Center fold line for inside view */}
            {currentView === 'inside' && (
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 opacity-50" />
            )}

            {/* Generated image overlay */}
            <div className="relative w-full h-full rounded border-2 border-dashed border-gray-300 overflow-hidden">
              {currentView === 'front' && frontImageUrl ? (
                <img
                  src={frontImageUrl}
                  alt="AI Generated Card Front"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoaded(true)}
                />
              ) : currentView === 'inside' && insideImageUrl ? (
                <img
                  src={insideImageUrl}
                  alt="AI Generated Card Inside"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoaded(true)}
                />
              ) : (
                <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-sm font-medium mb-1">
                      {currentView === 'front' ? 'Front Design' : 'Inside Message'}
                    </div>
                    <div className="text-xs">AI Generated Content</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card edge detail */}
          <div className="absolute inset-0 rounded-lg ring-1 ring-black/5" />
        </div>

        {/* Print quality badge */}
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
          Print Ready
        </div>
      </div>

      {/* Card specifications */}
      {showDimensions && (
        <div className="text-center mt-4 text-sm text-gray-500">
          <div>Premium 300gsm cardstock</div>
          <div>Professional matte finish</div>
        </div>
      )}
    </div>
  );
}
