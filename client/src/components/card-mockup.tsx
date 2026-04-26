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
            alt="Greeting card front"
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

  // Inside view - show open card view with blank left and content right
  return (
    <div className="w-full flex justify-center">
      <div className="flex gap-1 max-w-2xl">
        {/* Left page (blank) */}
        <div className="w-64 h-64 bg-white border-2 border-gray-300 rounded-l-lg flex items-center justify-center shadow-lg">
          <span className="text-gray-400 text-sm font-medium">Left side blank</span>
        </div>

        {/* Right page (inside content) */}
        <div className="w-64 h-64 border-2 border-gray-300 rounded-r-lg overflow-hidden shadow-lg">
          {insideImageUrl ? (
            <img 
              src={insideImageUrl} 
              alt="Greeting card inside"
              className="w-full h-full object-cover"
              style={{ borderRadius: '0' }}
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Inside generating...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}