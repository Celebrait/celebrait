import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Mountain, Camera, Palette, MessageSquare, Check, ArrowLeft, Info, Upload, Wand2 } from "lucide-react";

interface Step5Props {
  onboarding: any;
}

export default function Step5SceneChoice({ onboarding }: Step5Props) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    if (option === 'upload-and-scene') {
      onboarding.setSelectedSceneType('with-person');
    } else if (option === 'upload-and-transform') {
      onboarding.setSelectedSceneType('with-person');
    } else if (option === 'describe-person') {
      onboarding.setSelectedSceneType('with-person');
    }
    onboarding.nextStep();
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Perfect, <span className="text-ethereal-purple">{onboarding.userName}</span>! 
        </h2>
        <p className="text-lg text-slate-gray mb-2">We can represent your loved one in 3 ways:</p>
        <p className="text-sm text-gray-600">Click "How it works" to see examples of each approach</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Option 1: Upload Photo + Describe Scene */}
        <Card className="bg-white/80 border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
                <Upload className="text-white w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Upload Photo + Scene</h3>
            </div>
            
            <p className="text-slate-gray text-sm mb-4">
              Upload their photo and describe the scene you want them in. AI creates an artistic version.
            </p>
            
            <div className="space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full mb-3">
                    <Info className="w-4 h-4 mr-2" />
                    How it works
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Upload Photo + Describe Scene</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-gray-600">AI analyzes your uploaded photo to understand their appearance, then places them artistically in your described scene.</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="bg-gray-100 rounded-lg p-6 mb-2 h-48 flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-500">Your uploaded photo</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium">BEFORE: Original Photo</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg p-6 mb-2 h-48 flex items-center justify-center">
                          <div className="text-center">
                            <Palette className="w-12 h-12 mx-auto mb-2 text-purple-500" />
                            <p className="text-sm text-purple-600">Artistic scene with them</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium">AFTER: AI Artwork</p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Best for:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Most realistic representation</li>
                        <li>• When you have a clear photo</li>
                        <li>• Custom scene ideas</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                onClick={() => handleOptionSelect('upload-and-scene')}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                Choose This Option
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Upload Photo + Transform Style */}
        <Card className="bg-white/80 border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3">
                <Wand2 className="text-white w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Upload + Transform</h3>
            </div>
            
            <p className="text-slate-gray text-sm mb-4">
              Upload their photo and transform it into different artistic styles and characters.
            </p>
            
            <div className="space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full mb-3">
                    <Info className="w-4 h-4 mr-2" />
                    How it works
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Upload Photo + Transform Style</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-gray-600">AI transforms your uploaded photo into different artistic styles, costumes, or character representations while maintaining their likeness.</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="bg-gray-100 rounded-lg p-6 mb-2 h-48 flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-500">Your uploaded photo</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium">BEFORE: Original Photo</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg p-6 mb-2 h-48 flex items-center justify-center">
                          <div className="text-center">
                            <Wand2 className="w-12 h-12 mx-auto mb-2 text-pink-500" />
                            <p className="text-sm text-pink-600">Transformed character</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium">AFTER: Style Transform</p>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Best for:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Fun character transformations</li>
                        <li>• Costume/style changes</li>
                        <li>• Creative interpretations</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                onClick={() => handleOptionSelect('upload-and-transform')}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                Choose This Option
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Option 3: Describe Person + Scene */}
        <Card className="bg-white/80 border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mr-3">
                <MessageSquare className="text-white w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Describe Everything</h3>
            </div>
            
            <p className="text-slate-gray text-sm mb-4">
              Describe their appearance and the scene. AI creates everything from your descriptions.
            </p>
            
            <div className="space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full mb-3">
                    <Info className="w-4 h-4 mr-2" />
                    How it works
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Describe Person + Scene</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-gray-600">AI creates both the person and scene entirely from your text descriptions. No photo needed - just tell us what they look like and what scene you want.</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="bg-gray-100 rounded-lg p-6 mb-2 h-48 flex items-center justify-center">
                          <div className="text-center">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-500">Your descriptions</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium">BEFORE: Text Descriptions</p>
                      </div>
                      <div className="text-center">
                        <div className="bg-gradient-to-br from-green-100 to-blue-100 rounded-lg p-6 mb-2 h-48 flex items-center justify-center">
                          <div className="text-center">
                            <Users className="w-12 h-12 mx-auto mb-2 text-green-500" />
                            <p className="text-sm text-green-600">Complete AI artwork</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium">AFTER: Generated Art</p>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Best for:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• No photo available</li>
                        <li>• Creative freedom</li>
                        <li>• Stylized representations</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                onClick={() => handleOptionSelect('describe-person')}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
              >
                Choose This Option
              </Button>
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
