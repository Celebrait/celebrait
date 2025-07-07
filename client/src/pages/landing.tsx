import { useEffect, useState } from 'react';
import { Link } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

function HeroSection() {
  const typingPhrases = [
    'intelligence having fun',
    'the future of greetings cards',
    'mind. blown.'
  ];

  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const currentPhrase = typingPhrases[currentPhraseIndex];

    if (typing && charIndex < currentPhrase.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + currentPhrase[charIndex]);
        setCharIndex(charIndex + 1);
      }, 80);
      return () => clearTimeout(timeout);
    } else if (typing && charIndex === currentPhrase.length) {
      setTyping(false);
      setTimeout(() => setTyping(false), 1500);
    } else {
      const timeout = setTimeout(() => {
        setCharIndex(0);
        setDisplayText('');
        setTyping(true);
        setCurrentPhraseIndex((prev) => (prev + 1) % typingPhrases.length);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, typing]);

  return (
    <section className="text-center max-w-4xl mx-auto px-4 md:px-8 py-12 space-y-4">
      <h2 className="text-xl text-gray-500">
        Welcome to{' '}
        <span className="font-semibold bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">
          {displayText}
        </span>
      </h2>
      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">
        Turn your photos into mind-blowing greeting cards powered by AI
      </h1>
      
      {/* Value Propositions */}
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-200">
          <p className="text-lg font-semibold text-purple-800">
            Place your loved one into any scene imaginable
          </p>
        </div>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200">
          <p className="text-lg font-semibold text-blue-800">
            Transform your favourite photo into any style you can think of ✨
          </p>
        </div>
      </div>
    </section>
  );
}

function ImageCarousel() {
  const [activeTab, setActiveTab] = useState<'scene' | 'transform'>('scene');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Create 10 placeholder image pairs for each tab
  const sceneImages = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    front: `Scene Front ${i + 1}`,
    inside: `Scene Inside ${i + 1}`
  }));
  
  const transformImages = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    front: `Transform Front ${i + 1}`,
    inside: `Transform Inside ${i + 1}`
  }));
  
  const currentImages = activeTab === 'scene' ? sceneImages : transformImages;
  const imagesPerView = 4;
  const maxIndex = Math.max(0, currentImages.length - imagesPerView);
  
  const nextSlide = () => {
    setCurrentIndex(prev => Math.min(prev + 1, maxIndex));
  };
  
  const prevSlide = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };
  
  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Tab Buttons */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 rounded-full p-1 flex">
          <button
            onClick={() => { setActiveTab('scene'); setCurrentIndex(0); }}
            className={`px-6 py-3 rounded-full font-medium transition-all ${
              activeTab === 'scene' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Upload Photo(s) + Describe Scene
          </button>
          <button
            onClick={() => { setActiveTab('transform'); setCurrentIndex(0); }}
            className={`px-6 py-3 rounded-full font-medium transition-all ${
              activeTab === 'transform' 
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Upload Photo + Transform Style
          </button>
        </div>
      </div>
      
      {/* Carousel */}
      <div className="relative">
        <div className="flex items-center justify-center space-x-2">
          {/* Previous Button */}
          <button
            onClick={prevSlide}
            disabled={currentIndex === 0}
            className="p-2 rounded-full bg-white shadow-lg border disabled:opacity-50 hover:shadow-xl transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          {/* Images Container */}
          <div className="flex space-x-4 overflow-hidden">
            {currentImages.slice(currentIndex, currentIndex + imagesPerView).map((image) => (
              <div key={image.id} className="flex-shrink-0">
                <div className="space-y-2">
                  {/* Front Image */}
                  <div className="relative">
                    <div className="w-32 h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                      <span className="text-gray-500 text-sm text-center">{image.front}</span>
                    </div>
                    <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                      Front
                    </div>
                  </div>
                  
                  {/* Inside Image */}
                  <div className="relative">
                    <div className="w-32 h-32 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                      <span className="text-gray-500 text-sm text-center">{image.inside}</span>
                    </div>
                    <div className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs px-2 py-1 rounded-full">
                      Inside
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Next Button */}
          <button
            onClick={nextSlide}
            disabled={currentIndex >= maxIndex}
            className="p-2 rounded-full bg-white shadow-lg border disabled:opacity-50 hover:shadow-xl transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        
        {/* Carousel Indicators */}
        <div className="flex justify-center mt-4 space-x-2">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? 'bg-purple-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen relative">
      <Header />

      <main className="py-8 space-y-16">
        {/* Hero Section */}
        <HeroSection />
        
        {/* CTA Button - Closer to text */}
        <div className="text-center -mt-8">
          <Link to="/create-card">
            <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-lg">
              Start Creating Your Card
            </Button>
          </Link>
          
          {/* Delivery Options Message */}
          <p className="mt-4 text-gray-600 text-lg max-w-lg mx-auto">
            Available in printed format (delivered to your door) or digital format (instant download & sharing)
          </p>
        </div>
        
        {/* Video Section */}
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            See How It Works
          </h3>
          <p className="text-gray-600 mb-8">
            Watch this quick demo to see how our AI creates stunning personalized greeting cards in minutes
          </p>
          
          {/* Video Container */}
          <div className="relative bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-8 border-2 border-purple-200">
            <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-pink-900/20"></div>
              <div className="relative z-10 text-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 mb-4 inline-block">
                  <Play className="w-12 h-12 text-white ml-1" />
                </div>
                <p className="text-white text-xl font-semibold">
                  Watch Demo Video
                </p>
                <p className="text-white/80 mt-2">
                  See AI magic in action
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Image Carousel Section */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Browse Our Card Examples
            </h3>
            <p className="text-gray-600 text-lg">
              Explore stunning examples of our two creation methods
            </p>
          </div>
          
          <ImageCarousel />
        </div>
      </main>

      <Footer />
    </div>
  );
}