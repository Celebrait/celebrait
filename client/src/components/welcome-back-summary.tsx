import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit2, ArrowRight, Sparkles, Heart, Calendar, User, Camera, Palette, MessageSquare } from "lucide-react";

interface WelcomeBackSummaryProps {
  answers: Record<string, any>;
  authenticatedUser: { firstName: string; lastName: string; email: string };
  onEditField: (fieldId: string) => void;
  onContinueToGeneration: () => void;
  selectedDeliveryType: 'printed' | 'digital';
  selectedPhotoOption: string;
}

export default function WelcomeBackSummary({ 
  answers, 
  authenticatedUser, 
  onEditField, 
  onContinueToGeneration,
  selectedDeliveryType,
  selectedPhotoOption
}: WelcomeBackSummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleContinue = () => {
    setIsGenerating(true);
    onContinueToGeneration();
  };

  const getPhotoOptionLabel = (option: string) => {
    switch (option) {
      case 'upload_and_scene': return 'Photo + Scene Description';
      case 'upload_and_transform': return 'Photo Style Transformation';
      default: return option;
    }
  };

  const getCelebrationLabel = (celebration: string) => {
    const celebrations: Record<string, string> = {
      'birthday': 'Birthday',
      'anniversary': 'Anniversary',
      'graduation': 'Graduation',
      'wedding': 'Wedding',
      'baby_shower': 'Baby Shower',
      'retirement': 'Retirement',
      'mothers_day': "Mother's Day",
      'fathers_day': "Father's Day",
      'valentines': "Valentine's Day",
      'christmas': 'Christmas',
      'new_year': 'New Year',
      'easter': 'Easter'
    };
    return celebrations[celebration] || celebration;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Welcome Back Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {authenticatedUser.firstName}! 👋
            </h1>
            <p className="text-gray-600 text-lg">
              Great to see you again! Let's pick up exactly where you left off with {answers.name}'s special {getCelebrationLabel(answers.celebration || '')} card.
            </p>
          </div>

          {/* Progress Summary */}
          <Card className="mb-6 backdrop-blur-sm bg-white/80 border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-purple-500" />
                <h2 className="text-xl font-semibold text-gray-900">Your Card Details</h2>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Ready to Continue
                </Badge>
              </div>

              <div className="space-y-4">
                {/* Recipient Name */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-gray-900">Recipient</p>
                      <p className="text-gray-600">{answers.name || 'Not specified'}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('name')}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Celebration */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-gray-900">Celebration</p>
                      <p className="text-gray-600">{getCelebrationLabel(answers.celebration || 'Not specified')}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('celebration')}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Delivery Method */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-blue-500 rounded"></div>
                    <div>
                      <p className="font-medium text-gray-900">Delivery Method</p>
                      <p className="text-gray-600">
                        {selectedDeliveryType === 'digital' ? 'Digital Card ($29)' : 'Printed Card ($129)'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">Selected</Badge>
                </div>

                {/* Photo Option */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-gray-900">Photo Option</p>
                      <p className="text-gray-600">{getPhotoOptionLabel(selectedPhotoOption)}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('photo_option')}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Art Style if available */}
                {answers.art_style && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Palette className="w-5 h-5 text-pink-500" />
                      <div>
                        <p className="font-medium text-gray-900">Art Style</p>
                        <p className="text-gray-600">{answers.art_style}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onEditField('art_style')}
                      className="text-purple-600 hover:text-purple-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Message if available */}
                {answers.message && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="font-medium text-gray-900">Your Message</p>
                        <p className="text-gray-600 line-clamp-2">{answers.message}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onEditField('message')}
                      className="text-purple-600 hover:text-purple-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Continue Button */}
          <div className="text-center">
            <Button
              onClick={handleContinue}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold py-4 text-lg shadow-lg"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Continuing Your Card...
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Continue Creating {answers.name}'s Card
                </>
              )}
            </Button>
            
            <p className="text-gray-500 text-sm mt-3">
              You can edit any details above before continuing, or proceed to finish creating your card.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}