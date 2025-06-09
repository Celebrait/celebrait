
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Check, ArrowLeft } from "lucide-react";

interface Step2Props {
  onboarding: any;
}

export default function Step2DeliveryChoice({ onboarding }: Step2Props) {
  const handleDeliverySelect = (type: 'printed' | 'digital') => {
    onboarding.setSelectedDelivery(type);
    if (type === 'printed') {
      onboarding.nextStep();
    } else {
      // Skip print options for digital
      onboarding.setCurrentStep(4);
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl border border-white/20 max-w-4xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">
          Hey <span className="text-ethereal-purple">{onboarding.userName}</span>! 👋
        </h2>
        <p className="text-base sm:text-lg text-slate-gray px-4">How would you like to share your greeting card?</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 relative"
          onClick={() => handleDeliverySelect('printed')}
        >
          {/* Most Popular Badge */}
          <div className="absolute -top-2 sm:-top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-bold shadow-lg z-10">
            Most Popular
          </div>
          <CardContent className="p-4 sm:p-6">
            <img 
              src="https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
              alt="Printed greeting cards" 
              className="w-full aspect-square object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <Printer className="text-white w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Printed & Delivered</h3>
            </div>
            
            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Personalised AI image featuring loved one/friend</span>
              </li>
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Personalised message on front of card</span>
              </li>
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Personalised message inside card</span>
              </li>
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Hand delivered to you by Aidan in Hout Bay</span>
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-bold text-ethereal-purple">R89 - R129</span>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-white/80 border-2 border-gray-300 cursor-not-allowed transition-all duration-300 relative opacity-75"
        >
          <CardContent className="p-4 sm:p-6">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400" 
                alt="Digital greeting cards on mobile" 
                className="w-full aspect-square object-cover rounded-xl mb-4" 
              />
              {/* Coming Soon Overlay positioned over image only */}
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center mb-4">
                <div className="bg-white rounded-lg px-4 sm:px-6 py-2 sm:py-3 shadow-lg">
                  <span className="text-sm sm:text-lg font-bold text-gray-800">Coming Soon</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center mb-3 sm:mb-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Digital Share</h3>
            </div>
            
            <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Instant delivery</span>
              </li>
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Share via WhatsApp, email, social</span>
              </li>
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Interactive animations</span>
              </li>
              <li className="flex items-start text-slate-gray text-sm sm:text-base">
                <Check className="text-green-500 mr-2 sm:mr-3 w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Eco-friendly option</span>
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-xl sm:text-2xl font-bold text-warm-pink">R39 - R59</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back Button */}
      <div className="flex justify-center mt-6 sm:mt-8">
        <Button
          onClick={onboarding.previousStep}
          variant="ghost"
          className="text-gray-500 hover:text-gray-700 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back a Step
        </Button>
      </div>
    </div>
  );
}
