import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image, Layers, Check, Lightbulb, Gift, ArrowLeft } from "lucide-react";

interface Step3Props {
  onboarding: any;
}

export default function Step3PrintedOptions({ onboarding }: Step3Props) {
  const handlePrintOptionSelect = (option: 'front-only' | 'front-and-inside') => {
    onboarding.setSelectedPrintOption(option);
    onboarding.nextStep();
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Perfect choice! 🎨</h2>
        <p className="text-lg text-slate-gray">Now, what part of your card would you like us to design?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105"
          onClick={() => handlePrintOptionSelect('front-only')}
        >
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=500" 
              alt="Front of greeting card design" 
              className="w-full h-48 object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <Image className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Front Only</h3>
            </div>
            
            <ul className="space-y-2 mb-4">
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                AI-designed front cover
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Write your own message inside
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Perfect for personal touch
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Blank interior for handwriting
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-ethereal-purple">R89</span>
              <span className="text-sm text-slate-gray">Standard</span>
            </div>
            
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Lightbulb className="text-blue-600 w-4 h-4 mt-0.5" />
                <p className="text-sm text-blue-700">Great when you want to add your personal handwritten message</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105"
          onClick={() => handlePrintOptionSelect('front-and-inside')}
        >
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=500" 
              alt="Both sides of greeting card design" 
              className="w-full h-48 object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-warm-pink to-sa-gold rounded-full flex items-center justify-center mr-3">
                <Layers className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Front + Inside</h3>
            </div>
            
            <ul className="space-y-2 mb-4">
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                AI-designed front and inside
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Complete personalized message
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Direct delivery ready
              </li>
              <li className="flex items-center text-slate-gray">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Coordinated design theme
              </li>
            </ul>
            
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-warm-pink">R129</span>
              <span className="text-sm text-green-600">Complete package!</span>
            </div>
            
            <div className="mt-3 p-3 bg-purple-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Gift className="text-purple-600 w-4 h-4 mt-0.5" />
                <p className="text-sm text-purple-700">Perfect for sending directly to your loved one</p>
              </div>
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
          Go Back
        </Button>
      </div>
    </div>
  );
}
