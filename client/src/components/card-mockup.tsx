
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
          {currentView === 'front' ? (
            /* Front view - single card */
            <div className="relative aspect-square p-3">
              <div className="relative w-full h-full overflow-hidden">
                {frontImageUrl ? (
                  <img
                    src={frontImageUrl}
                    alt="AI Generated Card Front"
                    className="w-full h-full object-cover"
                    onLoad={() => setImageLoaded(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center text-gray-400">
                      <div className="text-sm font-medium mb-1">Front Design</div>
                      <div className="text-xs">AI Generated Content</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Inside view - open card layout */
            <div className="relative aspect-[2/1] p-3">
              <div className="flex h-full gap-1">
                {/* Left page - blank */}
                <div className="flex-1 bg-white border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-xs font-medium mb-1">Left Page</div>
                    <div className="text-xs opacity-75">Blank</div>
                  </div>
                </div>
                
                {/* Center fold line */}
                <div className="w-px bg-gray-400"></div>
                
                {/* Right page - inside content */}
                <div className="flex-1 overflow-hidden">
                  {insideImageUrl ? (
                    <img
                      src={insideImageUrl}
                      alt="AI Generated Card Inside"
                      className="w-full h-full object-cover"
                      onLoad={() => setImageLoaded(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-300">
                      <div className="text-center text-gray-400">
                        <div className="text-xs font-medium mb-1">Inside Message</div>
                        <div className="text-xs">AI Generated Content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
