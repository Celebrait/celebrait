import { useEffect, useState } from 'react';
import { Link, useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import sampleCard from "@/assets/sample-card.jpeg";
import founder1 from "@/assets/founder1.png";
import founder2 from "@/assets/founder2.png";

function HeroSection() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const typingPhrases = [
    'Greetings, reimagined',
    'the end of boring',
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

  // Fade in effect when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateMasterpiece = () => {
    setIsLoading(true);
    
    // Brief loading effect
    setTimeout(() => {
      setLocation('/create-card');
    }, 800);
  };

  return (
    <section className={`text-center max-w-4xl mx-auto px-4 md:px-8 py-12 space-y-6 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <h2 className="text-xl text-gray-500">
        Welcome to{' '}
        <span className="font-semibold bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">
          {displayText}
        </span>
      </h2>

      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">
        Turn your photos into mind-blowing greeting cards powered by AI
      </h1>

      <p className="text-gray-600 text-lg max-w-xl mx-auto">
        Describe any scene imaginable featuring your loved one or friend ✨ Printed and delivered anywhere in South Africa.
      </p>

      <div className="pt-4 space-y-3">
        <Button 
          onClick={handleCreateMasterpiece}
          disabled={isLoading}
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Launching AI Studio...
            </>
          ) : (
            'Get Started'
          )}
        </Button>
        
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 max-w-lg mx-auto">
          <p className="text-green-800 font-medium text-xs flex items-center justify-center gap-1">
            <span className="text-green-600">✨</span>
            Try before you buy: Create and preview your card before purchasing!
          </p>
        </div>
      </div>
    </section>
  );
}



function WatchVideoSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 space-y-6 text-center">
      <h2 className="text-3xl md:text-4xl font-extrabold">
        <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">
          Watch How it Works
        </span>
      </h2>

      <div className="w-full h-0 pb-[56.25%] relative rounded-2xl overflow-hidden shadow-lg max-w-4xl mx-auto">
        <iframe
          src="https://www.youtube.com/embed/dQw4w9WgXcQ" // replace with your video URL
          title="How it Works"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>
    </section>
  );
}

function SeeHowItLooksSection() {
  return (
    <section className="w-full py-16 pb-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold">
          <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">
            See How It Looks
          </span>
        </h2>
        
        {/* Swipe instruction */}
        <div className="mt-4">
          <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            Swipe to see more
            <ChevronRight className="w-4 h-4" />
          </p>
        </div>
      </div>
      
      <div className="relative overflow-hidden">
        <div className="flex gap-4 items-end overflow-x-auto scrollbar-hide pb-20" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* First set of card pairs */}
          {Array.from({ length: 6 }, (_, pairIndex) => (
            <div key={pairIndex} className="flex gap-4 items-end">
              {/* Front of card */}
              <div className="flex-shrink-0 relative">
                <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-lg bg-white">
                  <img
                    src={sampleCard}
                    alt={`Sample card front ${pairIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-md">
                    Front of Card
                  </span>
                </div>
              </div>
              
              {/* Inside of card - slightly higher position */}
              <div className="flex-shrink-0 relative -mb-8">
                <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-lg bg-white">
                  <img
                    src={sampleCard}
                    alt={`Sample card inside ${pairIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-md">
                    Inside of Card
                  </span>
                </div>
              </div>
              
              {/* Vertical separator after each pair */}
              {pairIndex < 5 && (
                <div className="flex-shrink-0 w-px h-64 bg-gray-300/50 mx-6 self-center"></div>
              )}
            </div>
          ))}
          
          {/* Duplicate set for seamless loop */}
          {Array.from({ length: 6 }, (_, pairIndex) => (
            <div key={pairIndex + 6} className="flex gap-4 items-end">
              {/* Front of card */}
              <div className="flex-shrink-0 relative">
                <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-lg bg-white">
                  <img
                    src={sampleCard}
                    alt={`Sample card front ${pairIndex + 7}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-md">
                    Front of Card
                  </span>
                </div>
              </div>
              
              {/* Inside of card - slightly higher position */}
              <div className="flex-shrink-0 relative -mb-8">
                <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-lg bg-white">
                  <img
                    src={sampleCard}
                    alt={`Sample card inside ${pairIndex + 7}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-md">
                    Inside of Card
                  </span>
                </div>
              </div>
              
              {/* Vertical separator after each pair */}
              {pairIndex < 5 && (
                <div className="flex-shrink-0 w-px h-64 bg-gray-300/50 mx-6 self-center"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LargeImageSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const images = [
    {
      src: founder1,
      alt: "Founder message card 1"
    },
    {
      src: founder2,
      alt: "Founder message card 2"
    }
  ];

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  };

  return (
    <div className="mx-auto mt-16 mb-8 px-4 max-w-4xl">
      <div className="relative">

        
        {/* Image container */}
        <div className="relative aspect-square bg-white rounded-2xl shadow-lg overflow-hidden w-full max-w-lg mx-auto md:max-w-2xl">
          <div 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {images.map((image, index) => (
              <div key={index} className="w-full flex-shrink-0">
                <img 
                  src={image.src} 
                  alt={image.alt}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          
          {/* Navigation arrows */}
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
        
        {/* Dots indicator */}
        <div className="flex justify-center mt-4 space-x-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-purple-500 w-6' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CallToActionSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 text-center">
      <div className="text-3xl md:text-4xl font-extrabold mb-12 space-y-2">
        <div>Greetings, <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">earthling</span>.</div>
        <div>Welcome to the end of <span className="line-through bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">boring</span>.</div>
      </div>
      
      <LargeImageSection />
      
      <div className="text-3xl md:text-4xl font-extrabold mb-8 mt-16">
        Ready to have your <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">mind blown?</span>
      </div>
      
      <div className="space-y-3">
        <Link to="/create-card">
          <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-lg">
            Get Started
          </Button>
        </Link>
        
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 max-w-lg mx-auto">
          <p className="text-green-800 font-medium text-xs flex items-center justify-center gap-1">
            <span className="text-green-600">✨</span>
            Try before you buy: Create and preview your card before purchasing!
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [isVisible, setIsVisible] = useState(false);

  // Fade in effect when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen relative">
      <Header />

      <main className={`py-8 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <HeroSection />
        {/* <WatchVideoSection /> */}
        {/* <SeeHowItLooksSection /> */}
        <CallToActionSection />
      </main>

      <Footer />
    </div>
  );
}
