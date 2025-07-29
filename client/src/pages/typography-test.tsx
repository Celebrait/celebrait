import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { generateTypographyWithDebug } from "@shared/typography";

export default function TypographyTest() {
  const [artStyle, setArtStyle] = useState("3D animation");
  const [sceneDescription, setSceneDescription] = useState("A magical fairytale scene with a princess in an enchanted forest");
  const [result, setResult] = useState<any>(null);

  const testExamples = [
    {
      name: "3D Animation + Fairytale",
      artStyle: "3D animation",
      scene: "A magical fairytale scene with a princess in an enchanted forest surrounded by glowing mushrooms and friendly woodland creatures"
    },
    {
      name: "3D Animation + Sci-Fi",
      artStyle: "3D animation",
      scene: "A futuristic space station with advanced technology, holographic displays, and robotic companions in a cyberpunk setting"
    },
    {
      name: "Flat Illustration + Vintage",
      artStyle: "modern flat illustration",
      scene: "A vintage 1950s diner scene with classic cars, neon signs, and retro fashion in nostalgic americana style"
    },
    {
      name: "Flat Illustration + Nature",
      artStyle: "modern flat illustration",
      scene: "A peaceful botanical garden with blooming flowers, butterflies, and serene pathways under soft morning sunlight"
    },
    {
      name: "3D Animation + Adventure",
      artStyle: "3D animation",
      scene: "An epic mountain climbing adventure with dramatic peaks, challenging terrain, and heroic exploration"
    },
    {
      name: "Flat Illustration + Modern",
      artStyle: "modern flat illustration",
      scene: "A sleek contemporary office space with minimalist design, tech gadgets, and urban city views"
    }
  ];

  const analyzeTypography = () => {
    const debugResult = generateTypographyWithDebug(artStyle, sceneDescription);
    setResult(debugResult);
  };

  const loadExample = (example: any) => {
    setArtStyle(example.artStyle);
    setSceneDescription(example.scene);
    setResult(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Contextual Typography System Test</h1>
        <p className="text-gray-600 mb-6">
          Test how the typography system analyzes scene descriptions and generates appropriate 
          typography instructions based on art style and detected themes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="art-style">Art Style</Label>
              <Select value={artStyle} onValueChange={setArtStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3D animation">3D Animation</SelectItem>
                  <SelectItem value="modern flat illustration">Modern Flat Illustration</SelectItem>
                  <SelectItem value="contemporary editorial illustration">Contemporary Editorial</SelectItem>
                  <SelectItem value="animated movie style">Animated Movie Style</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="scene">Scene Description</Label>
              <Textarea
                id="scene"
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                placeholder="Describe the scene context..."
                rows={4}
              />
            </div>

            <Button onClick={analyzeTypography} className="w-full">
              Analyze Typography
            </Button>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">Quick Test Examples</h3>
              <div className="grid grid-cols-1 gap-2">
                {testExamples.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    onClick={() => loadExample(example)}
                    className="text-left justify-start h-auto p-3"
                  >
                    <div>
                      <div className="font-medium">{example.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {example.scene.substring(0, 50)}...
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Typography Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                {/* Debug Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Analysis Debug Info</h4>
                  <div className="text-sm space-y-2">
                    <div>
                      <strong>Art Style Category:</strong> 
                      <Badge variant="secondary" className="ml-2">
                        {result.debug.artStyleCategory}
                      </Badge>
                    </div>
                    <div>
                      <strong>Detected Theme:</strong>
                      <Badge variant="default" className="ml-2">
                        {result.debug.detectedTheme.primary}
                      </Badge>
                      {result.debug.detectedTheme.secondary && (
                        <Badge variant="outline" className="ml-1">
                          {result.debug.detectedTheme.secondary}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <strong>Mood:</strong>
                      <Badge variant="outline" className="ml-2">
                        {result.debug.detectedTheme.mood}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Typography Style Details */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Selected Typography Style</h4>
                  <div className="text-sm space-y-2">
                    <div>
                      <strong>Description:</strong>
                      <p className="text-gray-700 mt-1">{result.debug.selectedStyle.description}</p>
                    </div>
                    <div>
                      <strong>Font Characteristics:</strong>
                      <p className="text-gray-700 mt-1">{result.debug.selectedStyle.fontCharacteristics}</p>
                    </div>
                    <div>
                      <strong>Visual Treatment:</strong>
                      <p className="text-gray-700 mt-1">{result.debug.selectedStyle.treatment}</p>
                    </div>
                    <div>
                      <strong>Examples:</strong>
                      <p className="text-gray-700 mt-1 italic">{result.debug.selectedStyle.examples}</p>
                    </div>
                  </div>
                </div>

                {/* Final Typography Instruction */}
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">Generated Typography Instruction</h4>
                  <div className="text-sm bg-white p-3 rounded border">
                    <code className="whitespace-pre-wrap">{result.instruction}</code>
                  </div>
                </div>

                {/* Usage Example */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">How This Gets Used in Prompts</h4>
                  <div className="text-sm bg-white p-3 rounded border">
                    <div className="text-gray-600 mb-2">Example Front Card Prompt:</div>
                    <code className="text-xs whitespace-pre-wrap">
{`Full-bleed square greeting card design, no borders, no background, no card mockup. ${artStyle} style. The scene is: ${sceneDescription}. Text overlay: "Happy Birthday Sarah!". ${result.instruction}. Print-ready artwork filling entire frame.`}
                    </code>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Select an art style and scene description, then click "Analyze Typography" to see results.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How It Works Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How the Contextual Typography System Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <h4>Scene Theme Analysis</h4>
            <p>The system analyzes scene descriptions for thematic patterns like:</p>
            <ul className="text-sm">
              <li><strong>Fairytale:</strong> magical, enchanted, princess, castle, dragon, fantasy</li>
              <li><strong>Adventure:</strong> journey, exploration, quest, hiking, wilderness</li>
              <li><strong>Romance:</strong> romantic, valentine, love, wedding, hearts</li>
              <li><strong>Sci-Fi:</strong> futuristic, space, robot, technology, cyber</li>
              <li><strong>Vintage:</strong> retro, classic, nostalgic, 1920s, victorian</li>
              <li><strong>Modern:</strong> contemporary, sleek, minimalist, urban, tech</li>
            </ul>

            <h4 className="mt-4">Art Style Categories</h4>
            <p>Typography is matched to art style categories:</p>
            <ul className="text-sm">
              <li><strong>3D Animation:</strong> Uses dimensional typography with movie-style aesthetics</li>
              <li><strong>Flat Illustration:</strong> Uses flat typography with contemporary design principles</li>
            </ul>

            <h4 className="mt-4">Contextual Matching</h4>
            <p>The system combines detected themes with art styles to create appropriate typography:</p>
            <ul className="text-sm">
              <li>3D Animation + Fairytale = Whimsical 3D typography like Disney/Pixar films</li>
              <li>3D Animation + Sci-Fi = Futuristic 3D typography with holographic effects</li>
              <li>Flat Illustration + Vintage = Retro flat typography with period-appropriate styling</li>
              <li>Flat Illustration + Modern = Contemporary flat typography with geometric precision</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}