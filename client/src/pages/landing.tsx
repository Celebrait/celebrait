import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import sampleCard from "@/assets/sample-card.jpeg";
import founder1 from "@/assets/founder1.png";
import founder2 from "@/assets/founder2.png";
import cardExample1Front from "@assets/image_1758792931055.png";
import cardExample1Inside from "@assets/image_1758792941633.png";
import cardExample2Front from "@assets/image_1758809123282.png";
import cardExample2Inside from "@assets/image_1758809131632.png";
import fathersDayFront from "@/assets/fathers-day-front.png";
import fathersDayInside from "@/assets/fathers-day-inside-new.png";

// Optimized carousel images - 2 sets of 6 for better variety
const carouselImages = [
  { src: cardExample1Front, alt: "Birthday fairy celebration card front", type: "front" },
  { src: cardExample1Inside, alt: "Birthday celebration card inside message", type: "inside" },
  { src: cardExample2Front, alt: "Congratulations award ceremony card front", type: "front" },
  { src: cardExample2Inside, alt: "Congratulations card inside message", type: "inside" },
  { src: fathersDayFront, alt: "Father's Day safari adventure card front", type: "front" },
  { src: fathersDayInside, alt: "Father's Day heartfelt message card inside", type: "inside" },
  { src: sampleCard, alt: "Wedding celebration card", type: "front" },
  { src: sampleCard, alt: "Graduation achievement card", type: "inside" },
  { src: sampleCard, alt: "Anniversary milestone card", type: "front" },
  { src: sampleCard, alt: "Holiday greetings card", type: "inside" },
  { src: sampleCard, alt: "Thank you appreciation card", type: "front" },
  { src: sampleCard, alt: "New baby celebration card", type: "inside" }
];

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



// Video section hidden per user request
// function WatchVideoSection() {
//   return (
//     <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 space-y-6 text-center">
//       <h2 className="text-3xl md:text-4xl font-extrabold">
//         <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">
//           Watch How it Works
//         </span>
//       </h2>

//       <div className="w-full h-0 pb-[56.25%] relative rounded-2xl overflow-hidden shadow-lg max-w-4xl mx-auto">
//         <iframe
//           src="https://www.youtube.com/embed/dQw4w9WgXcQ" // replace with your video URL
//           title="How it Works"
//           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
//           allowFullScreen
//           className="absolute top-0 left-0 w-full h-full"
//         />
//       </div>
//     </section>
//   );
// }

// Optimized image component with lazy loading
function OptimizedImage({ src, alt, className, ...props }: { 
  src: string; 
  alt: string; 
  className?: string; 
  [key: string]: any; 
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '100px' } // Start loading 100px before the image comes into view
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } w-full h-full object-cover`}
          {...props}
        />
      )}
      {!isLoaded && isInView && (
        <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 bg-gray-300 rounded-full animate-bounce"></div>
        </div>
      )}
    </div>
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
          {/* Optimized carousel with fewer images and lazy loading */}
          {carouselImages.map((imageData, index) => [
              <div key={`card-${index}`} className={`flex-shrink-0 relative ${index % 2 === 1 ? '-mb-8' : ''}`}>
                <div className="w-72 h-72 rounded-2xl overflow-hidden shadow-lg bg-white">
                  <OptimizedImage
                    src={imageData.src}
                    alt={imageData.alt}
                    className="w-full h-full"
                  />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-700 shadow-md">
                    {imageData.type === 'front' ? 'Front of Card' : 'Inside of Card'}
                  </span>
                </div>
              </div>,
              
              /* Vertical separator after each pair (after every 2nd image) */
              index % 2 === 1 && index < carouselImages.length - 1 && (
                <div key={`separator-${index}`} className="flex-shrink-0 w-px h-64 bg-gray-300/50 mx-6 self-center"></div>
              )
            ].filter(Boolean)
          )}
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
                {/* Only load the current and next image to reduce initial load time */}
                {(index === currentIndex || index === currentIndex + 1 || index === currentIndex - 1) ? (
                  <OptimizedImage 
                    src={image.src} 
                    alt={image.alt}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100"></div>
                )}
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
        <div>Welcome to the end of <span className="line-through decoration-purple-500 decoration-2 bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">boring</span>.</div>
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

const AUTH_FLOW_KEY = 'celebrait_auth_pending_card';

export default function Landing() {
  const [isVisible, setIsVisible] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Check for pending card data after auth redirect
  useEffect(() => {
    if (isLoading) return;
    
    try {
      const pendingData = sessionStorage.getItem(AUTH_FLOW_KEY);
      if (pendingData && isAuthenticated) {
        console.log('[AUTH REDIRECT] Found pending card data, redirecting to create-card');
        setLocation('/create-card');
      }
    } catch (error) {
      console.error('[AUTH REDIRECT] Error checking pending data:', error);
    }
  }, [isAuthenticated, isLoading, setLocation]);

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
        <SeeHowItLooksSection />
        <CallToActionSection />
      </main>

      <Footer />
    </div>
  );
}
