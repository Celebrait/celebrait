import { useEffect, useState } from 'react';
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

function SeeHowItsMadeSection() {
  const [activeToggle, setActiveToggle] = useState<'describe' | 'transform'>('describe');
  const [revealedBoxes, setRevealedBoxes] = useState<Set<string>>(new Set());

  const toggleBox = (boxId: string) => {
    setRevealedBoxes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(boxId)) {
        newSet.delete(boxId);
      } else {
        newSet.add(boxId);
      }
      return newSet;
    });
  };

  const describeSceneData = [
    {
      sceneDescription: "a cozy coffee shop with warm lighting",
      artStyle: "Watercolor",
      frontText: "Happy Birthday Sarah!",
      insideText: "Hope your day is as wonderful as you are!"
    },
    {
      sceneDescription: "a beautiful garden party with balloons",
      artStyle: "Oil Painting",
      frontText: "Congratulations Emma!",
      insideText: "Your graduation is just the beginning!"
    },
    {
      sceneDescription: "a magical forest with fairy lights",
      artStyle: "Fantasy Realism",
      frontText: "Happy Anniversary!",
      insideText: "Here's to many more years of love and laughter!"
    },
    {
      sceneDescription: "a beach sunset with palm trees",
      artStyle: "Anime",
      frontText: "Get Well Soon!",
      insideText: "Sending you healing thoughts and warm wishes!"
    },
    {
      sceneDescription: "a winter wonderland with snow",
      artStyle: "Pixel Art",
      frontText: "Merry Christmas!",
      insideText: "May your holidays be filled with joy and wonder!"
    }
  ];

  const transformStyleData = [
    {
      artStyle: "Watercolor",
      frontText: "Happy Birthday Mom!",
      insideText: "Thanks for being the best mom in the world!"
    },
    {
      artStyle: "Oil Painting",
      frontText: "Miss You Dad!",
      insideText: "Can't wait to see you again soon!"
    },
    {
      artStyle: "Fantasy Realism",
      frontText: "Happy Valentine's Day!",
      insideText: "You make every day feel like magic!"
    },
    {
      artStyle: "Anime",
      frontText: "Thank You!",
      insideText: "Your friendship means the world to me!"
    },
    {
      artStyle: "Pixel Art",
      frontText: "Happy New Year!",
      insideText: "Here's to new adventures and memories!"
    }
  ];

  return (
    <section className="w-full py-16 pb-24 bg-gray-50">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold">
          <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-transparent bg-clip-text">
            See How It's Made
          </span>
        </h2>
        <p className="text-gray-600 mt-4">Scroll or swipe to see what we're capable of</p>
      </div>

      {/* Toggle Buttons */}
      <div className="flex justify-center mb-12">
        <div className="bg-white rounded-lg p-1 shadow-md">
          <button
            onClick={() => setActiveToggle('describe')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeToggle === 'describe'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload Photo(s) & Describe Scene
          </button>
          <button
            onClick={() => setActiveToggle('transform')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeToggle === 'transform'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upload Photo & Transform Style
          </button>
        </div>
      </div>
      
      <div className="relative">
        <div className="flex gap-8 overflow-x-auto scrollbar-hide pb-4 items-start">
          {/* First set of card pairs */}
          {(activeToggle === 'describe' ? describeSceneData : transformStyleData).map((data, pairIndex) => (
            <div key={pairIndex} className="flex gap-4 items-start">
              {/* Card Pair Container */}
              <div className="flex-shrink-0 space-y-20">
                <div className="flex gap-4 items-end">
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
                </div>
                
                {/* Description under card pair */}
                <div className="max-w-lg mx-auto">
                  {!revealedBoxes.has(`${activeToggle}-${pairIndex}`) ? (
                    <button
                      onClick={() => toggleBox(`${activeToggle}-${pairIndex}`)}
                      className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-3 rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      How it was made
                    </button>
                  ) : (
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 shadow-md border border-purple-100 relative">
                      <button
                        onClick={() => toggleBox(`${activeToggle}-${pairIndex}`)}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl"
                      >
                        ×
                      </button>
                      <p className="text-sm text-gray-800 leading-relaxed text-center font-medium">
                        {activeToggle === 'describe' ? (
                          <>
                            Celebrait placed loved one in <strong className="text-purple-700">"{data.sceneDescription}"</strong> and made it <strong className="text-blue-700">{data.artStyle}</strong> with custom text on the front and inside.
                          </>
                        ) : (
                          <>
                            Celebrait took loved one's photo and made it <strong className="text-purple-700">{data.artStyle}</strong> with custom text on the front and inside.
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Vertical separator after each pair */}
              {pairIndex < 4 && (
                <div className="flex-shrink-0 w-px h-64 bg-gray-300/50 mx-6 self-center"></div>
              )}
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
        <SeeHowItsMadeSection />
      </main>

      <Footer />
    </div>
  );
}
