import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { 
  Scan, Map, Layout, PenTool, Pencil, Layers, Mountain, Users, Focus, Sun, Settings,
  Type, AlignCenter, Search, RefreshCw, RotateCcw, Package, CheckCircle, Clock
} from "lucide-react";

// Duplicate of the CreativeJourneyLoading component for preview
const CreativeJourneyPreview = () => {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [frontImagePreview, setFrontImagePreview] = useState<string | null>(null);
  const [insideImagePreview, setInsideImagePreview] = useState<string | null>(null);

  // Sample answers for preview
  const answers = {
    name: "Emma",
    celebration: "birthday"
  };

  // 12-Phase Creative Journey Definition
  const creativePhases = [
    // FRONT CARD CREATION (8 phases)
    { 
      id: 'photo_analysis', 
      title: 'Analyzing Your Photo', 
      description: `Studying the lighting, composition, and unique features that make ${answers.name || 'them'} special`,
      icon: Scan, 
      color: 'from-purple-500 to-pink-500',
      section: 'Front Card Creation' 
    },
    { 
      id: 'scene_planning', 
      title: 'Planning the Scene', 
      description: `Designing the perfect ${answers.celebration || 'celebration'} environment and setting`,
      icon: Map, 
      color: 'from-pink-500 to-rose-500',
      section: 'Front Card Creation' 
    },
    { 
      id: 'initial_sketching', 
      title: 'Initial Sketching', 
      description: 'Creating the foundational composition and artistic layout',
      icon: PenTool, 
      color: 'from-rose-500 to-orange-500',
      section: 'Front Card Creation' 
    },
    { 
      id: 'base_scene', 
      title: 'Building Base Scene', 
      description: 'Constructing the background world and atmospheric elements',
      icon: Layers, 
      color: 'from-orange-500 to-amber-500',
      section: 'Front Card Creation' 
    },
    { 
      id: 'face_perfection', 
      title: 'Perfecting Faces', 
      description: `Capturing ${answers.name || 'their'} authentic likeness and joyful expression`,
      icon: Focus, 
      color: 'from-amber-500 to-yellow-500',
      section: 'Front Card Creation' 
    },
    { 
      id: 'color_lighting', 
      title: 'Color & Lighting', 
      description: 'Applying the perfect palette and atmospheric lighting effects',
      icon: Sun, 
      color: 'from-yellow-500 to-lime-500',
      section: 'Front Card Creation' 
    },
    { 
      id: 'fine_details', 
      title: 'Adding Fine Details', 
      description: 'Enhancing textures, shadows, and intricate artistic elements',
      icon: Settings, 
      color: 'from-lime-500 to-green-500',
      section: 'Front Card Creation' 
    },
    { 
      id: 'typography_front', 
      title: 'Typography Integration', 
      description: 'Weaving your message naturally into the artistic composition',
      icon: Type, 
      color: 'from-green-500 to-emerald-500',
      section: 'Front Card Creation' 
    },
    
    // INSIDE CARD CREATION (4 phases)
    { 
      id: 'front_analysis', 
      title: 'Studying Front Design', 
      description: 'Analyzing the front card to ensure perfect visual harmony',
      icon: Search, 
      color: 'from-emerald-500 to-teal-500',
      section: 'Inside Card Creation' 
    },
    { 
      id: 'color_matching', 
      title: 'Color Matching', 
      description: 'Ensuring seamless color consistency between front and inside',
      icon: RefreshCw, 
      color: 'from-teal-500 to-cyan-500',
      section: 'Inside Card Creation' 
    },
    { 
      id: 'typography_harmony', 
      title: 'Typography Harmony', 
      description: 'Matching text styles for a cohesive design language',
      icon: AlignCenter, 
      color: 'from-cyan-500 to-blue-500',
      section: 'Inside Card Creation' 
    },
    { 
      id: 'final_assembly', 
      title: 'Final Assembly', 
      description: 'Polishing and packaging your one-of-a-kind masterpiece',
      icon: Package, 
      color: 'from-blue-500 to-purple-500',
      section: 'Inside Card Creation' 
    },
  ];

  // Real AI Progress Event Listener
  useEffect(() => {
    const handleAIProgress = (event: CustomEvent) => {
      const { phase, progress, imageUrl } = event.detail;
      console.log(`🎨 Creative Journey: ${phase} - ${progress}%`, { imageUrl: !!imageUrl });
      
      // Map AI progress to Creative Journey phases
      const phaseMapping: { [key: string]: number } = {
        'photo_analysis': 0,
        'scene_planning': 1,
        'initial_sketching': 2,
        'base_scene': 3,
        'face_perfection': 4,
        'color_lighting': 5,
        'fine_details': 6,
        'typography_front': 7,
        'front_analysis': 8,
        'color_matching': 9,
        'typography_harmony': 10,
        'typography_inside': 10,
        'journey_complete': 11,
        'final_assembly': 11
      };
      
      const targetPhase = phaseMapping[phase] ?? currentPhase;
      
      // Update phase and progress based on real AI generation
      if (targetPhase > currentPhase) {
        setCurrentPhase(targetPhase);
        setPhaseProgress(progress <= 100 ? progress : 100);
      } else if (targetPhase === currentPhase) {
        setPhaseProgress(progress <= 100 ? progress : 100);
      }
      
      // Show actual generated images when they're ready
      if (imageUrl && phase === 'typography_front') {
        setFrontImagePreview(imageUrl);
      } else if (imageUrl && (phase === 'typography_inside' || phase === 'typography_harmony')) {
        setInsideImagePreview(imageUrl);
      }
      
      // Mark as complete when journey finishes
      if ((phase === 'journey_complete' || phase === 'final_assembly') && progress >= 100) {
        setIsRunning(false);
        setIsComplete(true);
      }
    };

    // Listen for real AI progress events
    window.addEventListener('ai-generation-progress', handleAIProgress as EventListener);
    
    return () => {
      window.removeEventListener('ai-generation-progress', handleAIProgress as EventListener);
    };
  }, []);

  // Start/restart the preview - now just initializes state
  const startPreview = () => {
    setCurrentPhase(0);
    setPhaseProgress(0);
    setIsRunning(true);
    setIsComplete(false);
    setFrontImagePreview(null);
    setInsideImagePreview(null);
    
    console.log('🚀 Creative Journey: Waiting for real AI progress events...');
  };

  const currentPhaseData = creativePhases[currentPhase];
  const overallProgress = Math.min(100, ((currentPhase * 100 + phaseProgress) / creativePhases.length));
  const frontCardComplete = currentPhase >= 8;

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-xl border border-white/20 max-w-4xl mx-auto" data-testid="creative-journey-preview">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="relative mb-6">
          {/* Main Icon with Animated Ring */}
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"></div>
            <div className="absolute inset-2 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <currentPhaseData.icon className="text-white w-10 h-10" />
            </div>
            {/* Progress Ring */}
            <svg className="absolute inset-0 w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="44"
                stroke="white/30"
                strokeWidth="2"
                fill="none"
              />
              <circle
                cx="48"
                cy="48"
                r="44"
                stroke="url(#progressGradient)"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - overallProgress / 100)}`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
          Creating {answers.name ? `${answers.name}'s` : 'Your'} {answers.celebration ? answers.celebration.charAt(0).toUpperCase() + answers.celebration.slice(1) : 'Special'} Card
        </h2>
        
        <p className="text-sm md:text-base text-gray-600 opacity-75">
          {isComplete ? (
            <span className="text-green-600 font-medium flex items-center justify-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Masterpiece Complete!
            </span>
          ) : (
            `${currentPhaseData.section} • Phase ${currentPhase + 1} of ${creativePhases.length}`
          )}
        </p>
      </div>

      {/* Current Phase Display */}
      <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${currentPhaseData.color} flex items-center justify-center`}>
            <currentPhaseData.icon className="text-white w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-1">
              {isComplete ? 'Journey Complete!' : currentPhaseData.title}
            </h3>
            <p className="text-sm md:text-base text-gray-600">
              {isComplete 
                ? `Your personalized ${answers.celebration || 'greeting'} card for ${answers.name || 'them'} is ready! Each detail has been crafted with care to create something truly special.`
                : currentPhaseData.description
              }
            </p>
          </div>
        </div>

        {/* Phase Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Current Phase</span>
            <span>{Math.round(phaseProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full bg-gradient-to-r ${currentPhaseData.color} transition-all duration-1000 ease-out`}
              style={{ width: `${phaseProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/20 mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{Math.round(overallProgress)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-out"
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>

        {/* Phase Sections */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className={`p-3 rounded-lg border-2 transition-all duration-500 ${
            !frontCardComplete 
              ? 'border-purple-300 bg-purple-50 text-purple-700' 
              : 'border-green-300 bg-green-50 text-green-700'
          }`}>
            <div className="text-xs font-medium mb-1">Front Card</div>
            <div className="text-lg font-bold">
              {frontCardComplete ? (
                <span className="flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete
                </span>
              ) : (
                `${currentPhase + 1}/8`
              )}
            </div>
          </div>
          <div className={`p-3 rounded-lg border-2 transition-all duration-500 ${
            currentPhase < 8 
              ? 'border-gray-200 bg-gray-50 text-gray-500' 
              : (currentPhase === creativePhases.length - 1 && phaseProgress >= 100)
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-blue-300 bg-blue-50 text-blue-700'
          }`}>
            <div className="text-xs font-medium mb-1">Inside Card</div>
            <div className="text-lg font-bold">
              {currentPhase < 8 ? (
                'Pending'
              ) : (currentPhase === creativePhases.length - 1 && phaseProgress >= 100) ? (
                <span className="flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete
                </span>
              ) : (
                `${currentPhase - 7}/4`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generated Image Previews */}
      {(frontImagePreview || insideImagePreview) && (
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/20 mb-6">
          <h3 className="text-center text-lg font-semibold text-gray-800 mb-4">
            ✨ Live Results from OpenAI
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Front Card Preview */}
            {frontImagePreview && (
              <div className="text-center">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Front Card</h4>
                <div className="relative rounded-lg overflow-hidden shadow-lg">
                  <img 
                    src={frontImagePreview} 
                    alt="Generated front card preview"
                    className="w-full h-auto max-h-64 object-cover"
                    data-testid="img-front-preview"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    Generated!
                  </div>
                </div>
              </div>
            )}
            
            {/* Inside Card Preview */}
            {insideImagePreview && (
              <div className="text-center">
                <h4 className="text-sm font-medium text-gray-600 mb-2">Inside Card</h4>
                <div className="relative rounded-lg overflow-hidden shadow-lg">
                  <img 
                    src={insideImagePreview} 
                    alt="Generated inside card preview"
                    className="w-full h-auto max-h-64 object-cover"
                    data-testid="img-inside-preview"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                    Generated!
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-center text-xs text-gray-500 mt-3">
            🎯 These are actual images generated by OpenAI during the creative process!
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="text-center">
        <Button 
          onClick={startPreview} 
          disabled={isRunning}
          className="bg-gradient-celebrait hover:opacity-90 text-white px-8 py-3 rounded-2xl font-semibold"
          data-testid="button-start-preview"
        >
          {isRunning ? (
            <>
              <Clock className="w-5 h-5 mr-2 animate-spin" />
              Running Preview...
            </>
          ) : (
            isComplete ? 'Restart Journey' : 'Start Creative Journey'
          )}
        </Button>
        <p className="text-xs text-gray-500 mt-2">
          {isRunning ? 'Fast preview mode - 3 seconds per phase' : 'Click to see the 12-phase creative journey in action'}
        </p>
      </div>
    </div>
  );
};

export default function LoadingPreview() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <div className="p-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="text-gray-600 hover:text-gray-800"
          data-testid="button-back-to-home"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </Button>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-4">
            Creative Journey Preview
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Experience the immersive 12-phase creative journey that users see during card generation. 
            This transforms boring wait time into an engaging artistic education.
          </p>
        </div>

      </div>
    </div>
  );
}