import { Brain, MessageCircle, Palette, Heart, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step4Props {
  onboarding: any;
}

export default function Step4AILoading({ onboarding }: Step4Props) {
  const handleContinue = () => {
    onboarding.nextStep();
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 text-center">
      <div className="mb-8">
        <div className="w-24 h-24 bg-gradient-celebrait rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse-soft">
          <Brain className="text-white text-3xl" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Our AI is warming up... 🤖✨</h2>
        <p className="text-lg text-slate-gray max-w-2xl mx-auto mb-6">
          Here's what our Celebrait AI will help you create:
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/80 rounded-2xl p-6">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <MessageCircle className="text-white" />
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Brainstorm Together</h3>
          <p className="text-sm text-slate-gray">Our AI will chat with you to understand exactly what you want</p>
        </div>
        
        <div className="bg-white/80 rounded-2xl p-6">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Palette className="text-white" />
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Create Art</h3>
          <p className="text-sm text-slate-gray">Generate stunning, unique artwork that captures your vision</p>
        </div>
        
        <div className="bg-white/80 rounded-2xl p-6">
          <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Heart className="text-white" />
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Personal Touch</h3>
          <p className="text-sm text-slate-gray">Every card is one-of-a-kind, just like your relationships</p>
        </div>
      </div>

      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="text-yellow-600 text-xl mt-1" />
          <div className="text-left">
            <h4 className="font-bold text-yellow-800 mb-2">Important: About AI-Generated People</h4>
            <p className="text-yellow-700 text-sm">
              Our AI creates <strong>artistic interpretations</strong> inspired by your descriptions. 
              While we aim for accuracy, the result will be a stylized artwork rather than an exact likeness. 
              Think of it as a beautiful, personalized illustration! 🎨
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={handleContinue}
        className="bg-gradient-celebrait hover:opacity-90 text-white px-8 py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
      >
        I understand, let's create! 🚀
      </Button>
    </div>
  );
}
