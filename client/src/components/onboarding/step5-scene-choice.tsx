import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Mountain, Check, ArrowLeft, Info, Camera, MessageSquare, Palette } from "lucide-react";

interface Step5Props {
  onboarding: any;
}

export default function Step5SceneChoice({ onboarding }: Step5Props) {
  const [openModal, setOpenModal] = useState<string | null>(null);

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
        <p className="text-lg text-slate-gray">We can represent your loved one in 3 ways. Choose your preferred approach:</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Option 1: Photo Upload */}
        <Card className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-2">
                  <Camera className="text-white w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Upload Photo</h3>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-1">
                    <Info className="w-4 h-4 text-gray-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>How Photo Upload Works</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-gray-700">Upload a photo and our AI will create an artistic representation while maintaining their likeness.</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="bg-gray-100 rounded-lg p-6 mb-2 h-32 flex items-center justify-center">
                          <span className="text-gray-500 font-medium">Original Photo</span>
                        </div>
                        <p className="text-sm text-gray-600">Your uploaded photo</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg p-6 mb-2 h-32 flex items-center justify-center">
                          <span className="text-purple-700 font-medium">AI Artwork</span>
                        </div>
                        <p className="text-sm text-gray-600">Artistic interpretation in your chosen scene</p>
                      </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">Best Results:</h4>
                      <ul className="text-blue-700 text-sm space-y-1">
                        <li>• Clear, well-lit photos</li>
                        <li>• Face visible and looking toward camera</li>
                        <li>• Single person in focus</li>
                        <li>• High resolution preferred</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-slate-gray text-sm mb-3">
              Most accurate representation using your photo as reference
            </p>
            <Button 
              onClick={() => handleSceneTypeSelect('with-person')}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500"
            >
              Choose This Option
            </Button>
          </CardContent>
        </Card>

        {/* Option 2: Text Description */}
        <Card className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center mr-2">
                  <MessageSquare className="text-white w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Text Description</h3>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-1">
                    <Info className="w-4 h-4 text-gray-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>How Text Description Works</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-gray-700">Describe your loved one's appearance and our AI will create artwork based on your description.</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="bg-gray-100 rounded-lg p-6 mb-2 h-32 flex items-center justify-center">
                          <span className="text-gray-500 font-medium text-center">"Brown hair, blue eyes, tall, glasses"</span>
                        </div>
                        <p className="text-sm text-gray-600">Your text description</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-gradient-to-br from-green-100 to-teal-100 rounded-lg p-6 mb-2 h-32 flex items-center justify-center">
                          <span className="text-green-700 font-medium">AI Character</span>
                        </div>
                        <p className="text-sm text-gray-600">AI-generated character from description</p>
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-2">Perfect For:</h4>
                      <ul className="text-green-700 text-sm space-y-1">
                        <li>• When you don't have a suitable photo</li>
                        <li>• Creating stylized or artistic interpretations</li>
                        <li>• More creative freedom in representation</li>
                        <li>• Fantasy or cartoon-style artwork</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-slate-gray text-sm mb-3">
              Describe their appearance and we'll create the perfect character
            </p>
            <Button 
              onClick={() => handleSceneTypeSelect('with-person')}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500"
            >
              Choose This Option
            </Button>
          </CardContent>
        </Card>

        {/* Option 3: Scene Only */}
        <Card className="bg-white/80 border-2 border-purple-200 hover:border-ethereal-purple cursor-pointer transition-all duration-300 hover:shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full flex items-center justify-center mr-2">
                  <Palette className="text-white w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Scene Only</h3>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-1">
                    <Info className="w-4 h-4 text-gray-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>How Scene Only Works</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-gray-700">Create beautiful artwork focused on scenes, objects, or abstract concepts without people.</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="bg-gray-100 rounded-lg p-6 mb-2 h-32 flex items-center justify-center">
                          <span className="text-gray-500 font-medium text-center">"Sunset beach scene"</span>
                        </div>
                        <p className="text-sm text-gray-600">Your concept or message</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-gradient-to-br from-orange-100 to-pink-100 rounded-lg p-6 mb-2 h-32 flex items-center justify-center">
                          <span className="text-orange-700 font-medium">Beautiful Scene</span>
                        </div>
                        <p className="text-sm text-gray-600">Artistic scene with your message</p>
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-orange-800 mb-2">Great For:</h4>
                      <ul className="text-orange-700 text-sm space-y-1">
                        <li>• Abstract or conceptual messages</li>
                        <li>• Nature scenes and landscapes</li>
                        <li>• Objects and symbols</li>
                        <li>• Visual metaphors and artistic expressions</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-slate-gray text-sm mb-3">
              Focus on beautiful scenes and messages without people
            </p>
            <Button 
              onClick={() => handleSceneTypeSelect('scene-only')}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-500"
            >
              Choose This Option
            </Button>
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
