// Clean implementation without photo analysis for image-to-image approach
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
// Inline prompt building functions for image-to-image approach
const buildImagePrompt = (answers: any) => {
  let prompt = "Square 1:1 aspect ratio greeting card design, full bleed with no borders or card edges visible. ";
  
  if (answers.style_preference) {
    prompt += `${answers.style_preference} art style. `;
  }
  
  if (answers.scene_setting) {
    prompt += `Scene: ${answers.scene_setting}. `;
  }
  
  return prompt;
};

const buildInsidePrompt = (insideText: string, artStyle: string) => {
  return `${artStyle} style greeting card interior design with text: "${insideText}"`;
};

interface GuidedConversationProps {
  onboarding: any;
  onCardGenerated: (card: any) => void;
}

interface ConversationStep {
  id: string;
  question: string;
  aiMessage: string | JSX.Element;
  type: 'text' | 'select' | 'textarea' | 'summary' | 'multiselect' | 'final_summary' | 'photo_upload' | 'photo_creation_choice' | 'people_details';
  options?: Array<{ value: string; label: string; description?: string; color?: string; icon?: string; details?: string; disabled?: boolean }>;
  placeholder?: string;
  required?: boolean;
}

export default function GuidedConversation({ onboarding, onCardGenerated }: GuidedConversationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Define conversation steps for image-to-image approach
  const conversationSteps: ConversationStep[] = [
    {
      id: 'photo_option',
      question: 'What would you like to do with your photos?',
      aiMessage: 'I can help you create amazing greeting cards in two different ways! Choose your preferred approach:',
      type: 'select',
      options: [
        {
          value: 'upload_and_describe',
          label: 'Upload Photos + Describe Scene',
          description: 'Upload photos of people and I\'ll create a new artistic scene with them',
          color: 'bg-blue-500',
          icon: '🎨'
        },
        {
          value: 'upload_and_transform',
          label: 'Upload Photo + Transform Style',
          description: 'Upload one photo and I\'ll transform it into a different artistic style',
          color: 'bg-purple-500',
          icon: '✨'
        }
      ],
      required: true
    },
    {
      id: 'photo_upload',
      question: 'Upload your photos',
      aiMessage: 'Please upload your photos based on your selected option.',
      type: 'photo_upload',
      required: true
    },
    {
      id: 'style_preference',
      question: 'What artistic style do you prefer?',
      aiMessage: 'Choose the artistic style for your greeting card:',
      type: 'select',
      options: [
        { value: 'watercolor', label: 'Watercolor', description: 'Soft, flowing watercolor painting style' },
        { value: 'oil_painting', label: 'Oil Painting', description: 'Rich, textured oil painting style' },
        { value: 'digital_art', label: 'Digital Art', description: 'Modern digital illustration style' },
        { value: 'cartoon', label: 'Cartoon', description: 'Fun, animated cartoon style' },
        { value: 'realistic', label: 'Realistic', description: 'Photorealistic artistic style' }
      ],
      required: true
    },
    {
      id: 'scene_setting',
      question: 'Where should the scene take place?',
      aiMessage: 'Describe the setting or location for your greeting card:',
      type: 'text',
      placeholder: 'e.g., cozy living room, beautiful garden, snowy mountains...',
      required: true
    },
    {
      id: 'final_summary',
      question: 'Review and Generate',
      aiMessage: 'Perfect! Here\'s what I\'ll create for you:',
      type: 'final_summary',
      required: false
    }
  ];

  const currentStep = conversationSteps[currentStepIndex];

  const handleAnswer = (stepId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [stepId]: value }));
  };

  const handleNext = () => {
    if (currentStepIndex < conversationSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handlePhotosUploaded = () => {
    handleAnswer('photo_upload', uploadedPhotos);
    handleNext();
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate photo count based on selected option
    if (answers.photo_option === 'upload_and_transform' && files.length > 1) {
      toast({
        title: "Too many photos",
        description: "For style transformation, please upload only one photo.",
        variant: "destructive"
      });
      return;
    }

    const photoDataArray: string[] = [];
    let filesProcessed = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoData = e.target?.result as string;
        photoDataArray.push(photoData);
        filesProcessed++;
        
        if (filesProcessed === files.length) {
          setUploadedPhotos(photoDataArray);
          handlePhotosUploaded();
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const generateCard = async () => {
    setIsGenerating(true);
    
    try {
      // Build prompt based on answers and uploaded photos
      const frontPrompt = buildImagePrompt(answers);
      const insidePrompt = answers.inside_text ? buildInsidePrompt(answers.inside_text, answers.style_preference || 'watercolor') : null;

      // Create card with image-to-image generation
      const cardResponse = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardType: onboarding.selectedDelivery,
          printOption: onboarding.selectedPrintOption,
          frontPrompt,
          insidePrompt,
          uploadedPhotos,
          imageToImageMode: true,
          transformationType: answers.photo_option
        })
      });

      if (!cardResponse.ok) {
        throw new Error('Failed to create card');
      }

      const card = await cardResponse.json();
      onCardGenerated(card);
    } catch (error) {
      console.error('Error generating card:', error);
      toast({
        title: "Generation failed",
        description: "Something went wrong while creating your card. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep.type) {
      case 'select':
        return (
          <div className="space-y-4">
            {currentStep.options?.map((option) => (
              <Card 
                key={option.value} 
                className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                  answers[currentStep.id] === option.value 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => handleAnswer(currentStep.id, option.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    {option.icon && <span className="text-2xl">{option.icon}</span>}
                    <div>
                      <h3 className="font-semibold text-gray-900">{option.label}</h3>
                      {option.description && (
                        <p className="text-sm text-gray-600">{option.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'text':
        return (
          <Input
            placeholder={currentStep.placeholder}
            value={answers[currentStep.id] || ''}
            onChange={(e) => handleAnswer(currentStep.id, e.target.value)}
            className="w-full"
          />
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={currentStep.placeholder}
            value={answers[currentStep.id] || ''}
            onChange={(e) => handleAnswer(currentStep.id, e.target.value)}
            className="w-full min-h-[100px]"
          />
        );

      case 'photo_upload':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <h5 className="font-semibold text-blue-700 mb-2">
                {answers.photo_option === 'upload_and_transform' ? 'For Best Transformation:' : 'For Best Results:'}
              </h5>
              <ul className="text-blue-600 space-y-1">
                {answers.photo_option === 'upload_and_transform' ? (
                  <>
                    <li>• Upload exactly ONE photo only</li>
                    <li>• Clear, high-quality image</li>
                    <li>• Good lighting and contrast</li>
                    <li>• High resolution (at least 512x512)</li>
                  </>
                ) : (
                  <>
                    <li>• Can upload multiple photos</li>
                    <li>• Face clearly visible and well-lit</li>
                    <li>• High resolution (at least 512x512)</li>
                    <li>• One person per photo</li>
                  </>
                )}
              </ul>
            </div>

            {uploadedPhotos.length === 0 ? (
              <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple={answers.photo_option !== 'upload_and_transform'}
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="text-purple-600 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-purple-900 mb-2">
                    Click to upload {answers.photo_option === 'upload_and_transform' ? 'your photo' : 'photos'}
                  </p>
                  <p className="text-sm text-purple-600">
                    {answers.photo_option === 'upload_and_transform' ? 'JPG, PNG up to 10MB' : 'JPG, PNG up to 10MB each'}
                  </p>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center items-center gap-4 flex-wrap">
                  {uploadedPhotos.map((photo, index) => (
                    <div key={index} className="w-32 h-32 rounded-xl overflow-hidden border-4 border-purple-300">
                      <img 
                        src={photo} 
                        alt={`Uploaded photo ${index + 1}`} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-green-600 font-medium text-center">
                  {uploadedPhotos.length === 1 ? 'Photo uploaded successfully!' : `${uploadedPhotos.length} photos uploaded successfully!`}
                </p>
              </div>
            )}
          </div>
        );

      case 'final_summary':
        return (
          <div className="space-y-6">
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-4">Your Card Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-white">Approach</Badge>
                    <span className="text-sm">
                      {answers.photo_option === 'upload_and_transform' ? 'Style Transformation' : 'Scene Creation'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-white">Photos</Badge>
                    <span className="text-sm">{uploadedPhotos.length} uploaded</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-white">Style</Badge>
                    <span className="text-sm">{answers.style_preference || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-white">Setting</Badge>
                    <span className="text-sm">{answers.scene_setting || 'Not specified'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={generateCard}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Your Masterpiece...
                </>
              ) : (
                '✨ Generate My Card!'
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    const answer = answers[currentStep.id];
    
    if (currentStep.required && !answer) {
      return false;
    }

    if (currentStep.type === 'photo_upload' && uploadedPhotos.length === 0) {
      return false;
    }

    return true;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Progress indicator */}
      <div className="flex justify-between items-center mb-8">
        {conversationSteps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              index <= currentStepIndex
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {index + 1}
          </div>
        ))}
      </div>

      {/* Current step */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentStep.question}</h2>
          <div className="text-gray-600">{currentStep.aiMessage}</div>
        </div>

        {renderStepContent()}

        {/* Navigation buttons */}
        {currentStep.type !== 'final_summary' && (
          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}