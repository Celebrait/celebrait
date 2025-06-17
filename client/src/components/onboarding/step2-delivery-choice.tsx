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
      onboarding.setCurrentStep(4); // Skip to digital
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Hey <span className="text-ethereal-purple">{onboarding.userName}</span>!
        </h2>
        <p className="text-lg text-slate-gray">How would you like to share your greeting card?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Printed & Delivered */}
        <Card
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 relative"
          onClick={() => handleDeliverySelect('printed')}
        >
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg z-10">
            Most Popular
          </div>
          <CardContent className="p-6">
            <img
              src="/images/Printed_Delivered.png"
              alt="Printed greeting cards"
              className="w-full aspect-square object-cover rounded-xl mb-4"
            />

            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <Printer className="text-white w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Printed & Delivered</h3>
            </div>

            <p className="text-slate-gray mb-4">
              A beautifully printed card featuring your AI generated artwork + personalised message.
            </p>

            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Personalised AI image of a loved one/friend
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Printed message on the card front
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Custom message inside the card
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Hand-delivered to you by Aidan in Hout Bay
              </li>
            </ul>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xl font-bold text-ethereal-purple">R89 – R129</span>
            </div>
          </CardContent>
        </Card>

        {/* Digital Share (Coming Soon) */}
        <Card className="bg-white/80 border-2 border-gray-300 cursor-not-allowed transition-all duration-300 relative opacity-75">
          <CardContent className="p-6">
            <div className="relative">
              <img
                src="/images/Digital_Share.png"
                alt="Digital greeting card on phone"
                className="w-full aspect-square object-cover rounded-xl mb-4"
              />
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <div className="bg-white rounded-lg px-6 py-3 shadow-lg">
                  <span className="text-lg font-bold text-gray-800">Coming Soon</span>
                </div>
              </div>
            </div>

            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Digital Share</h3>
            </div>

            <p className="text-slate-gray mb-4">
              Send your greeting instantly via WhatsApp, email, or social media.
            </p>

            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Instant digital delivery
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Interactive animations included
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Share via WhatsApp, email, or social
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Eco-friendly option
              </li>
            </ul>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xl font-bold text-warm-pink">R39 – R59</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back Button */}
      <div className="flex justify-center mt-6">
        <Button
          onClick={onboarding.previousStep}
          variant="ghost"
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back a Step
        </Button>
      </div>
    </div>
  );
}
