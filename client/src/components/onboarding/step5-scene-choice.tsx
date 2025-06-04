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
          className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 relative"
          onClick={() => handleSceneTypeSelect('with-person')}
        >
          {/* Photo Upload Available Badge */}
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg z-10 whitespace-nowrap">
            Photo Upload Available
          </div>
          <CardContent className="p-6">
            <img 
              src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
              alt="AI generated artwork with people" 
              className="w-full aspect-square object-cover rounded-xl mb-4" 
            />
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-celebrait rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="5"/>
                  <path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Include your loved one or friend</h3>
            </div>
            
            <p className="text-slate-gray mb-4">
              Artistic representation of your loved one/friend.
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
                Upload a photo or describe what you want!
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
          <CardContent className="p-6">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1541961017774-22349e4a1262?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=400" 
                alt="Abstract creative artwork" 
                className="w-full aspect-square object-cover rounded-xl mb-4" 
              />
              {/* Coming Soon Overlay positioned over image only */}
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center mb-4">
                <div className="bg-white rounded-lg px-6 py-3 shadow-lg">
                  <span className="text-lg font-bold text-gray-800">Coming Soon</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-warm-pink to-sa-gold rounded-full flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6"/>
                  <path d="m9 9 3 3 3-3"/>
                </svg>
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
