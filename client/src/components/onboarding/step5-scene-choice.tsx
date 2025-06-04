import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Mountain, Check, ArrowLeft } from "lucide-react";

interface Step5Props {
  onboarding: any;
}

export default function Step5SceneChoice({ onboarding }: Step5Props) {
  const handleSceneTypeSelect = (type: 'with-person' | 'scene-only') => {
    onboarding.setSelectedSceneType(type);
    onboarding.nextStep();
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          One more thing, <span className="text-ethereal-purple">{onboarding.userName}</span>! 💭
        </h2>
        <p className="text-lg text-slate-gray">What kind of card would you like to create?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card 
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105"
          onClick={() => handleSceneTypeSelect('with-person')}
        >
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=500" 
              alt="AI generated artwork with people" 
              className="w-full h-48 object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <Users className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Include Your Loved One</h3>
            </div>
            
            <p className="text-slate-gray mb-4">
              Create a card featuring your loved one as a character in a fun, artistic scene. 
              Perfect for birthdays, celebrations, or just because!
            </p>
            
            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Artistic interpretation of your loved one
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Placed in creative, fun scenarios
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Highly personalized and unique
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card 
          className="bg-white/80 border-2 border-gray-300 cursor-not-allowed transition-all duration-300 relative opacity-75"
        >
          {/* Coming Soon Overlay */}
          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center z-10">
            <div className="bg-white rounded-lg px-6 py-3 shadow-lg">
              <span className="text-lg font-bold text-gray-800">Coming Soon</span>
            </div>
          </div>
          
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1541961017774-22349e4a1262?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=500" 
              alt="Abstract creative artwork" 
              className="w-full h-48 object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-warm-pink to-sa-gold rounded-full flex items-center justify-center mr-3">
                <Mountain className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Just a Scene & Message</h3>
            </div>
            
            <p className="text-slate-gray mb-4">
              Create a beautiful, abstract scene or visual metaphor with your message. 
              Perfect for expressing feelings, jokes, or creative concepts!
            </p>
            
            <ul className="space-y-2">
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Abstract and creative scenes
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Visual metaphors and jokes
              </li>
              <li className="flex items-center text-slate-gray text-sm">
                <Check className="text-green-500 mr-3 w-4 h-4" />
                Express feelings through art
              </li>
            </ul>
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
