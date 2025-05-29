import { Card, CardContent } from "@/components/ui/card";
import { Printer, Smartphone, Check } from "lucide-react";

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
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Hey <span className="text-ethereal-purple">{onboarding.userName}</span>! 👋
        </h2>
        <p className="text-lg text-slate-gray">How would you like to share your greeting card?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105"
          onClick={() => handleDeliverySelect('printed')}
        >
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=500" 
              alt="Printed greeting cards" 
              className="w-full h-48 object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <Printer className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Printed & Delivered</h3>
            </div>
            
            <ul className="space-y-2 mb-4">
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Premium quality cardstock
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Direct delivery to loved one
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Handwritten message option
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Includes envelope
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-ethereal-purple">R89</span>
              <span className="text-sm text-slate-gray">+ delivery</span>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105"
          onClick={() => handleDeliverySelect('digital')}
        >
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500" 
              alt="Digital greeting cards on mobile" 
              className="w-full h-48 object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-warm-pink to-sa-gold rounded-full flex items-center justify-center mr-3">
                <Smartphone className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Digital Share</h3>
            </div>
            
            <ul className="space-y-2 mb-4">
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Instant delivery
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Share via WhatsApp, email, social
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Interactive animations
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Eco-friendly option
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-warm-pink">R29</span>
              <span className="text-sm text-green-600">Most Popular!</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
