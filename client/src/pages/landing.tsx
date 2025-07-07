import React, { useEffect, useState } from 'react';
import { Link } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import sampleCard from "@/assets/sample-card.jpeg";

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
    <section className="text-center max-w-4xl mx-auto px-4 md:px-8 py-12 space-y-6">
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
        Celebrait good times with a personalised greeting card that's impossible to forget ✨ Sent in the post or through a digital link.
      </p>

      <div className="pt-4 space-y-3">
        <Link to="/create-card">
          <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-lg">
            Start Creating Your Card
          </Button>
        </Link>
        
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 max-w-2xl mx-auto">
          <p className="text-green-800 font-medium text-sm flex items-center justify-center gap-2">
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
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    let animationId: number;
    let startTime: number;
    const duration = 25000; // 25 seconds
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = (elapsed % duration) / duration;
      
      // Calculate scroll position - scroll exactly half the content width
      const scrollDistance = scrollContainer.scrollWidth / 2;
      const scrollLeft = progress * scrollDistance;
      
      scrollContainer.scrollLeft = scrollLeft;
      
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);
  
  return (
    <section className="w-full py-16 pb-32 bg-gray-50 overflow-hidden">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold">
          <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">
            See How It Looks
          </span>
        </h2>
      </div>
      
      <div className="relative pb-12">
        <div 
          ref={scrollRef}
          className="flex gap-6 items-center whitespace-nowrap overflow-hidden carousel-container"
        >
          {/* First set of cards */}
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex-shrink-0 text-center">
              <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-lg bg-white mb-4">
                <img
                  src={sampleCard}
                  alt={`Sample card ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded-full shadow-md inline-block">
                {index % 2 === 0 ? 'Front of Card' : 'Inside of Card'}
              </div>
            </div>
          ))}
          
          {/* Duplicate set for seamless looping */}
          {Array.from({ length: 8 }, (_, index) => (
            <div key={`duplicate-${index}`} className="flex-shrink-0 text-center">
              <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-lg bg-white mb-4">
                <img
                  src={sampleCard}
                  alt={`Sample card ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-sm font-medium text-gray-700 bg-white px-3 py-1 rounded-full shadow-md inline-block">
                {index % 2 === 0 ? 'Front of Card' : 'Inside of Card'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen relative">
      <Header />

      <main className="py-8">
        <HeroSection />
        <WatchVideoSection />
        <SeeHowItLooksSection />
      </main>

      <Footer />
    </div>
  );
}
