import { Brain } from 'lucide-react';

interface AILoadingProps {
  message?: string;
}

export default function AILoading({ message = "Processing..." }: AILoadingProps) {
  return (
    <div className="min-h-screen relative">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 z-40"></div>
      
      {/* Content positioned to match the onboarding layout */}
      <div className="relative z-50 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-white/20">
          <div className="text-center py-12 sm:py-16">
            <div className="relative mb-6">
              {/* Animated brain icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center animate-pulse">
                <Brain className="w-10 h-10 text-white" />
              </div>
              
              {/* Spinning ring around the brain */}
              <div className="absolute inset-0 w-20 h-20 mx-auto">
                <div className="w-full h-full border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin"></div>
              </div>
            </div>
            
            <p className="text-gray-700 font-medium text-lg">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}