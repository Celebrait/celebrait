
import React from 'react';

interface CardMockupProps {
  frontImageUrl?: string;
  insideImageUrl?: string;
  deliveryType: 'printed' | 'digital';
  currentView: 'front' | 'inside';
}

export default function CardMockup({ frontImageUrl, insideImageUrl, deliveryType, currentView }: CardMockupProps) {
  if (currentView === 'front') {
    return (
      <div className="w-full flex justify-center">
        {frontImageUrl ? (
          <img 
            src={frontImageUrl} 
            alt="AI generated greeting card front" 
            style={{ 
              display: 'block',
              maxWidth: '100%',
              maxHeight: '1028px',
              width: 'auto',
              height: 'auto'
            }}
            className="rounded-lg shadow-lg"
          />
        ) : (
          <div className="w-full aspect-square bg-gray-200 rounded-2xl flex items-center justify-center">
            <p className="text-gray-500">Card generating...</p>
          </div>
        )}
      </div>
    );
  }

  // Inside view handling based on delivery type
  if (deliveryType === 'printed') {
    // For printed cards, show open card mockup with blank left page
    return (
      <div className="w-full flex justify-center">
        <div className="flex gap-2 max-w-full">
          {/* Left page - blank */}
          <div 
            className="bg-white rounded-l-lg shadow-lg border-r border-gray-200"
            style={{
              aspectRatio: '1/1',
              width: 'auto',
              maxHeight: '500px',
              minWidth: '200px'
            }}
          />
          {/* Right page - inside content */}
          <div 
            className="rounded-r-lg shadow-lg overflow-hidden"
            style={{
              aspectRatio: '1/1',
              width: 'auto',
              maxHeight: '500px',
              minWidth: '200px'
            }}
          >
            {insideImageUrl ? (
              <img 
                src={insideImageUrl} 
                alt="AI generated greeting card inside" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Generating...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    // For digital cards, show both images side by side
    return (
      <div className="w-full flex justify-center">
        <div className="flex gap-4 max-w-full">
          {/* Front image */}
          <div 
            className="rounded-lg shadow-lg overflow-hidden"
            style={{
              aspectRatio: '1/1',
              width: 'auto',
              maxHeight: '400px',
              minWidth: '180px'
            }}
          >
            {frontImageUrl ? (
              <img 
                src={frontImageUrl} 
                alt="AI generated greeting card front" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Generating...</p>
              </div>
            )}
          </div>
          {/* Inside image */}
          <div 
            className="rounded-lg shadow-lg overflow-hidden"
            style={{
              aspectRatio: '1/1',
              width: 'auto',
              maxHeight: '400px',
              minWidth: '180px'
            }}
          >
            {insideImageUrl ? (
              <img 
                src={insideImageUrl} 
                alt="AI generated greeting card inside" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Generating...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
