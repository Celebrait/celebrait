import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Camera, Palette, Eye, Edit3 } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface PhotoCreationChoiceProps {
  onOptionSelected: (option: 'upload_and_scene' | 'upload_and_transform') => void;
}

export default function PhotoCreationChoice({ onOptionSelected }: PhotoCreationChoiceProps) {
  const options = [
    {
      value: 'upload_and_scene',
      label: 'Upload Photo + Describe Scene',
      description: 'Upload photos and describe the perfect scene to place your loved ones in',
      details: 'Perfect for creating custom scenes with multiple people or dream locations',
      color: 'bg-green-500',
      icon: 'camera'
    },
    {
      value: 'upload_and_transform',
      label: 'Upload Photo + Transform Style',
      description: 'Upload one photo and transform it into beautiful artistic styles',
      details: 'Great for stylizing existing photos with artistic effects',
      color: 'bg-purple-500',
      icon: 'palette'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          How would you like to create your card?
        </h2>
        <p className="text-gray-600 text-lg">
          Choose your preferred photo creation method
        </p>
      </div>

      {/* Options Grid */}
      <div className="space-y-6 max-w-2xl mx-auto">
        {options.map((option) => (
          <Card 
            key={option.value}
            onClick={() => onOptionSelected(option.value as 'upload_and_scene' | 'upload_and_transform')}
            className="cursor-pointer border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm"
          >
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 ${option.color} rounded-full flex items-center justify-center`}>
                  {option.icon === 'camera' && <Camera className="text-white w-6 h-6" />}
                  {option.icon === 'palette' && <Palette className="text-white w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{option.label}</h3>
                  <p className="text-gray-600 mb-3">{option.description}</p>
                  <p className="text-sm text-purple-600 font-medium mb-4">{option.details}</p>
                  
                  <div className="flex items-center justify-between">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOptionSelected(option.value as 'upload_and_scene' | 'upload_and_transform');
                      }}
                      className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-2 rounded-xl font-semibold"
                    >
                      Choose This Option
                    </Button>
                    
                    {/* How it works Button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          How it works
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-3">
                            <div className={`w-8 h-8 ${option.color} rounded-lg flex items-center justify-center text-lg`}>
                              {option.icon === 'camera' && <Camera className="text-white w-4 h-4" />}
                              {option.icon === 'palette' && <Palette className="text-white w-4 h-4" />}
                            </div>
                            {option.label}
                          </DialogTitle>
                          <DialogDescription>
                            Learn how this process works and see what to expect
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="overflow-y-auto max-h-[70vh] p-4 space-y-6">
                          {/* Swipable Image Examples */}
                          <div className="w-full">
                            <Carousel className="w-full">
                              <CarouselContent className="-ml-4">
                                {/* Photo Upload Example */}
                                <CarouselItem className="pl-4">
                                  <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                                    <div className="text-center">
                                      <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                      </div>
                                      <p className="text-gray-600 font-medium mb-1">Photo Upload Example</p>
                                      <p className="text-gray-500 text-sm">Example image will be added here</p>
                                    </div>
                                  </div>
                                </CarouselItem>
                                
                                {/* Final Scene Example */}
                                <CarouselItem className="pl-4">
                                  <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                                    <div className="text-center">
                                      <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <p className="text-gray-600 font-medium mb-1">Final Scene Example</p>
                                      <p className="text-gray-500 text-sm">Example image will be added here</p>
                                    </div>
                                  </div>
                                </CarouselItem>
                              </CarouselContent>
                              <CarouselPrevious className="left-2" />
                              <CarouselNext className="right-2" />
                            </Carousel>
                          </div>

                          {/* Process Description */}
                          <div className="space-y-4">
                            {option.value === 'upload_and_scene' ? (
                              <>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                  <h4 className="font-medium text-green-800 mb-2">How Upload Photo + Describe Scene Works:</h4>
                                  <div className="space-y-3 text-green-700 text-sm">
                                    <div className="flex items-start space-x-3">
                                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">1</div>
                                      <div>
                                        <p className="font-medium">Upload Photos</p>
                                        <p className="text-green-600">Upload clear photos of the people you want featured on the card.</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start space-x-3">
                                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">2</div>
                                      <div>
                                        <p className="font-medium">Describe Your Scene</p>
                                        <p className="text-green-600">Tell our AI what kind of scene you want - a beach sunset, cozy cafe, magical forest, or anything you can imagine!</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start space-x-3">
                                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">3</div>
                                      <div>
                                        <p className="font-medium">AI Creates Magic</p>
                                        <p className="text-green-600">Our AI places them into your custom scene while maintaining their likeness and creating a beautiful, artistic greeting card.</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                  <h4 className="font-medium text-blue-800 mb-2">Perfect For:</h4>
                                  <ul className="text-blue-700 text-sm space-y-1">
                                    <li>• Creating personalized scenes with custom messaging</li>
                                    <li>• Placing loved ones in dream locations</li>
                                    <li>• Making unique birthday, anniversary, or celebration cards</li>
                                    <li>• Combining multiple people from different photos into one scene</li>
                                  </ul>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                  <h4 className="font-medium text-purple-800 mb-2">How Upload Photo + Transform Style Works:</h4>
                                  <div className="space-y-3 text-purple-700 text-sm">
                                    <div className="flex items-start space-x-3">
                                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">1</div>
                                      <div>
                                        <p className="font-medium">Upload One Photo</p>
                                        <p className="text-purple-600">Upload ONE clear, high-quality photo that you'd like to transform artistically.</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start space-x-3">
                                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">2</div>
                                      <div>
                                        <p className="font-medium">Choose Art Style</p>
                                        <p className="text-purple-600">Select from various artistic styles like watercolor, oil painting, anime, cyberpunk, and many more.</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start space-x-3">
                                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">3</div>
                                      <div>
                                        <p className="font-medium">AI Transforms</p>
                                        <p className="text-purple-600">Our AI transforms your photo into the chosen artistic style while preserving the composition and key details.</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                                  <h4 className="font-medium text-pink-800 mb-2">Perfect For:</h4>
                                  <ul className="text-pink-700 text-sm space-y-1">
                                    <li>• Transforming special photos into unique artistic pieces</li>
                                    <li>• Creating stylized versions of memorable moments</li>
                                    <li>• Making artistic greeting cards from existing photos</li>
                                    <li>• Experimenting with different visual styles</li>
                                  </ul>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}