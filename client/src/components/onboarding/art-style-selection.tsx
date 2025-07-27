import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Palette } from "lucide-react";

interface ArtStyleSelectionProps {
  onStyleSelected: (style: string) => void;
  onBack: () => void;
  selectedStyle?: string;
}

const artStyles = [
  { 
    value: 'digital_art', 
    label: 'Digital Art', 
    description: 'Modern digital illustration with clean lines and vibrant colors',
    inspiration: 'Digital illustration, concept art',
    color: 'bg-blue-600',
    emoji: '💻'
  },
  { 
    value: 'ai_painterly', 
    label: 'AI-Painterly / Oil Portrait', 
    description: 'Classical oil painting with AI-enhanced realism',
    inspiration: 'Classical oil painting',
    color: 'bg-amber-600',
    emoji: '🎨'
  },
  { 
    value: 'anime', 
    label: 'Anime', 
    description: 'Studio Ghibli and modern anime character design',
    inspiration: 'Studio Ghibli, anime',
    color: 'bg-pink-500',
    emoji: '🌸'
  },
  { 
    value: 'cyberpunk', 
    label: 'Cyberpunk', 
    description: 'Neon, dystopian sci-fi environments',
    inspiration: 'Blade Runner, Cyberpunk 2077',
    color: 'bg-cyan-500',
    emoji: '🌆'
  },
  { 
    value: 'lego', 
    label: 'LEGO', 
    description: 'LEGO character aesthetics',
    inspiration: 'LEGO minifigures',
    color: 'bg-red-500',
    emoji: '🧱'
  },
  { 
    value: 'pixar', 
    label: 'Pixar', 
    description: 'Pixar-style facial proportions and textures',
    inspiration: 'Pixar animation',
    color: 'bg-blue-500',
    emoji: '🎬'
  },
  { 
    value: 'renaissance', 
    label: 'Renaissance Painting', 
    description: 'Old Masters, dramatic lighting, elaborate outfits',
    inspiration: 'Classical Renaissance art',
    color: 'bg-purple-700',
    emoji: '🏛️'
  },
  { 
    value: 'fantasy_realism', 
    label: 'Fantasy Realism', 
    description: 'Elven characters, fantasy worlds',
    inspiration: 'LOTR, Zelda',
    color: 'bg-emerald-600',
    emoji: '🧝'
  },
  { 
    value: 'pixel_art', 
    label: 'Pixel Art', 
    description: 'Retro video games',
    inspiration: '8-bit gaming',
    color: 'bg-indigo-500',
    emoji: '🎮'
  },
  { 
    value: 'barbie_glam', 
    label: 'Barbie / Glam Doll', 
    description: 'Hyper-feminine, glossy doll-like styles',
    inspiration: 'Barbie aesthetics',
    color: 'bg-pink-400',
    emoji: '💖'
  },
  { 
    value: 'grunge', 
    label: 'Grunge Aesthetic', 
    description: 'Y2K and 90s fashion, dark filters, and edgy tones',
    inspiration: '90s grunge culture',
    color: 'bg-gray-700',
    emoji: '⚡'
  },
  { 
    value: 'vaporwave', 
    label: 'Vaporwave', 
    description: '80s/90s digital nostalgia, chrome, pastel tones, VHS textures',
    inspiration: '80s/90s aesthetics',
    color: 'bg-violet-500',
    emoji: '📼'
  },
  { 
    value: 'mythical_creature', 
    label: 'Mythical Creature / Creature Fusion', 
    description: 'AI mashups of people with mythical beings',
    inspiration: 'Mermaids, dragons, fantasy creatures',
    color: 'bg-orange-600',
    emoji: '🐉'
  }
];

export default function ArtStyleSelection({ onStyleSelected, onBack, selectedStyle = 'digital_art' }: ArtStyleSelectionProps) {
  const [currentStyle, setCurrentStyle] = useState(selectedStyle);

  const handleStyleClick = (styleValue: string) => {
    setCurrentStyle(styleValue);
  };

  const handleContinue = () => {
    onStyleSelected(currentStyle);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mx-auto mb-4">
          <Palette className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Choose Your Art Style
        </h1>
        <p className="text-gray-600 text-lg">
          Select the perfect artistic style for your greeting card
        </p>
      </div>

      {/* Art Style Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {artStyles.map((style) => (
          <Card 
            key={style.value}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
              currentStyle === style.value 
                ? 'ring-2 ring-blue-500 shadow-lg' 
                : 'hover:shadow-md'
            }`}
            onClick={() => handleStyleClick(style.value)}
          >
            <CardContent className="p-6">
              <div className="space-y-3">
                {/* Icon and Title */}
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg ${style.color} flex items-center justify-center text-xl`}>
                    {style.emoji}
                  </div>
                  <h3 className="font-semibold text-gray-900">{style.label}</h3>
                </div>
                
                {/* Description */}
                <p className="text-sm text-gray-600 leading-relaxed">
                  {style.description}
                </p>
                
                {/* Inspiration */}
                <p className="text-xs text-gray-500 italic">
                  Inspired by: {style.inspiration}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>

        <Button
          onClick={handleContinue}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-2"
        >
          Continue with {artStyles.find(s => s.value === currentStyle)?.label}
        </Button>
      </div>
    </div>
  );
}