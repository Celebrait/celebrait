import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Heart, 
  Gift, 
  Truck, 
  Mail, 
  Clock, 
  Star,
  ChevronRight,
  Check,
  HelpCircle
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Header from '@/components/header';
import Footer from '@/components/footer';

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const handleDeliveryChoice = (deliveryType: 'printed' | 'digital') => {
    // Store delivery choice and navigate to onboarding
    sessionStorage.setItem('selectedDelivery', deliveryType);
    setLocation('/onboarding');
  };

  const sampleCards = [
    {
      title: "Birthday Celebration",
      description: "Watercolor style with balloons and confetti",
      image: "/api/placeholder/400/300",
      style: "Watercolor Dreams"
    },
    {
      title: "Anniversary Love",
      description: "Romantic sunset with couple silhouettes",
      image: "/api/placeholder/400/300", 
      style: "Romantic Vintage"
    },
    {
      title: "Graduation Success",
      description: "Modern minimalist with cap and diploma",
      image: "/api/placeholder/400/300",
      style: "Modern Minimalist"
    },
    {
      title: "Holiday Wishes",
      description: "Cozy winter scene with warm lighting",
      image: "/api/placeholder/400/300",
      style: "Cozy Illustration"
    },
    {
      title: "Thank You Note",
      description: "Elegant floral arrangement",
      image: "/api/placeholder/400/300",
      style: "Botanical Art"
    }
  ];

  const howItWorksSteps = [
    {
      step: 1,
      title: "Choose Your Style",
      description: "Select printed delivery or instant digital cards",
      icon: <Gift className="w-6 h-6" />
    },
    {
      step: 2,
      title: "Share Your Story",
      description: "Tell our AI about your celebration and recipient",
      icon: <Heart className="w-6 h-6" />
    },
    {
      step: 3,
      title: "AI Creates Magic",
      description: "Our AI generates your personalized greeting card",
      icon: <Sparkles className="w-6 h-6" />
    },
    {
      step: 4,
      title: "Receive & Enjoy",
      description: "Get your beautiful card delivered or instantly",
      icon: <Star className="w-6 h-6" />
    }
  ];

  const faqItems = [
    {
      question: "How long does it take to create my card?",
      answer: "Our AI typically generates your personalized card in 2-3 minutes. You'll receive an email notification when it's ready!"
    },
    {
      question: "Can I customize the art style?",
      answer: "Absolutely! You can describe any artistic style you envision - from watercolor paintings to anime styles, vintage posters to modern minimalism. Our AI can recreate any style you imagine."
    },
    {
      question: "What's the difference between printed and digital cards?",
      answer: "Printed cards are professionally printed on high-quality cardstock and delivered to your chosen address. Digital cards are delivered instantly via email and can be shared immediately or printed at home."
    },
    {
      question: "How is shipping handled for printed cards?",
      answer: "Printed cards are shipped within 3-5 business days. You'll receive tracking information and delivery updates via email."
    },
    {
      question: "Can I include photos in my card?",
      answer: "Yes! You can upload photos to be transformed into artistic styles or placed into custom scenes. Our AI will maintain the likeness while creating beautiful artwork."
    },
    {
      question: "What if I'm not satisfied with my card?",
      answer: "We want you to love your card! If you're not completely satisfied, contact our support team and we'll work with you to create the perfect card."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
            Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">AI-Powered</span> Greeting Cards
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Transform your celebrations with personalized greeting cards created by advanced AI. 
            Choose from instant digital delivery or beautiful printed cards.
          </p>
        </div>

        {/* Delivery Options */}
        <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
          {/* Printed Cards */}
          <Card 
            className="relative overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl bg-white/80 backdrop-blur-sm border-2 border-purple-200 hover:border-purple-400"
            onClick={() => handleDeliveryChoice('printed')}
          >
            <div className="absolute top-4 right-4">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                Premium
              </Badge>
            </div>
            <CardContent className="p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-6 mx-auto">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                Printed & Delivered
              </h3>
              <p className="text-gray-600 mb-6 text-center">
                Professional quality cards printed on premium cardstock and delivered to your door
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  High-quality cardstock printing
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  Front and inside personalization
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  Free shipping included
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  3-5 business day delivery
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-800">R129</div>
                <div className="text-sm text-gray-600">per card</div>
              </div>

              <Button 
                onClick={() => handleDeliveryChoice('printed')}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-4 text-lg font-semibold rounded-xl"
              >
                Create Printed Card
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Digital Cards */}
          <Card 
            className="relative overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl bg-white/80 backdrop-blur-sm border-2 border-blue-200 hover:border-blue-400"
            onClick={() => handleDeliveryChoice('digital')}
          >
            <div className="absolute top-4 right-4">
              <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                Instant
              </Badge>
            </div>
            <CardContent className="p-8">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mb-6 mx-auto">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                Digital Delivery
              </h3>
              <p className="text-gray-600 mb-6 text-center">
                Get your personalized card instantly via email. Perfect for last-minute celebrations!
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  Instant email delivery
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  High-resolution download
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  Easy sharing options
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 mr-2" />
                  Print at home option
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-800">R29</div>
                <div className="text-sm text-gray-600">per card</div>
              </div>

              <Button 
                onClick={() => handleDeliveryChoice('digital')}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-4 text-lg font-semibold rounded-xl"
              >
                Create Digital Card
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sample Cards Carousel */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              See What Our AI Can Create
            </h2>
            <p className="text-gray-600">
              Every card is uniquely generated based on your personal story and preferences
            </p>
          </div>
          
          <Carousel className="w-full max-w-5xl mx-auto">
            <CarouselContent className="-ml-4">
              {sampleCards.map((card, index) => (
                <CarouselItem key={index} className="pl-4 md:basis-1/2 lg:basis-1/3">
                  <Card className="overflow-hidden">
                    <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-8 h-8 text-white" />
                          </div>
                          <p className="text-gray-600 font-medium">{card.title}</p>
                          <p className="text-sm text-gray-500 mt-1">AI Generated Sample</p>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-800 mb-2">{card.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{card.description}</p>
                      <Badge variant="secondary" className="text-xs">
                        {card.style}
                      </Badge>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              How It Works
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Creating your personalized greeting card is simple and takes just a few minutes
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {howItWorksSteps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto text-white">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full border-2 border-purple-500 flex items-center justify-center text-purple-500 font-bold text-sm">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600">
              Everything you need to know about creating AI-powered greeting cards
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            <Card className="bg-white/80 backdrop-blur-sm border border-purple-200">
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  {faqItems.map((item, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center">
                          <HelpCircle className="w-5 h-5 text-purple-500 mr-3" />
                          {item.question}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600 pl-8">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">
                Ready to Create Your Perfect Card?
              </h3>
              <p className="mb-6 opacity-90">
                Join thousands of users who've already created beautiful, personalized greeting cards with our AI
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={() => handleDeliveryChoice('printed')}
                  className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-3 rounded-xl font-semibold"
                >
                  Create Printed Card
                </Button>
                <Button 
                  onClick={() => handleDeliveryChoice('digital')}
                  className="bg-white/20 text-white hover:bg-white/30 border border-white/30 px-8 py-3 rounded-xl font-semibold"
                >
                  Create Digital Card
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}