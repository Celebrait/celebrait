import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Sparkles, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ComparisonResult {
  technique: string;
  description: string;
  imageUrl?: string;
  likenessExpected: string;
  strength: string | number;
  error?: string;
}

interface TestResponse {
  success: boolean;
  results: ComparisonResult[];
  metadata: {
    totalTimeSeconds: string;
    sceneDescription: string;
    artStyle: string;
    recommendation: string;
  };
}

export default function SceneTest() {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [sceneDescription, setSceneDescription] = useState("");
  const [artStyle, setArtStyle] = useState("watercolor painting");
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [metadata, setMetadata] = useState<TestResponse['metadata'] | null>(null);
  const { toast } = useToast();

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!photoFile || !sceneDescription.trim()) {
      toast({
        title: "Missing Information",
        description: "Please upload a photo and provide a scene description.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setResults(null);
    setMetadata(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const photoBase64 = event.target?.result as string;

        const response = await apiRequest<TestResponse>("/api/test/scene-comparison", {
          method: "POST",
          body: JSON.stringify({
            photoBase64,
            sceneDescription,
            artStyle,
          }),
        });

        if (response.success) {
          setResults(response.results);
          setMetadata(response.metadata);
          toast({
            title: "Generation Complete!",
            description: `Completed in ${response.metadata.totalTimeSeconds}s. Compare the results below.`,
          });
        } else {
          throw new Error("Generation failed");
        }
      };
      reader.readAsDataURL(photoFile);
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate comparison images",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (imageUrl: string, technique: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `scene-test-${technique.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Scene Likeness Comparison Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Test different image generation techniques to find the best balance between scene transformation and facial likeness
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Test Parameters</CardTitle>
            <CardDescription>
              Upload a photo and describe the scene you want to create
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="photo-upload">Upload Photo</Label>
              <div className="mt-2 flex items-center gap-4">
                <Input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="flex-1"
                  data-testid="input-photo"
                />
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg border-2 border-purple-200"
                  />
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="scene-description">Scene Description</Label>
              <Textarea
                id="scene-description"
                placeholder="Example: Two people standing on a beautiful beach at sunset, waves in the background, warm golden light"
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                rows={3}
                className="mt-2"
                data-testid="input-scene"
              />
            </div>

            <div>
              <Label htmlFor="art-style">Art Style</Label>
              <Select value={artStyle} onValueChange={setArtStyle}>
                <SelectTrigger id="art-style" className="mt-2" data-testid="select-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="watercolor painting">Watercolor Painting</SelectItem>
                  <SelectItem value="oil painting">Oil Painting</SelectItem>
                  <SelectItem value="digital art">Digital Art</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !photoFile || !sceneDescription.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              size="lg"
              data-testid="button-generate"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating 4 Variations... (takes ~60-90s)
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Comparison
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {metadata && (
          <Card className="mb-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200">
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-purple-900 dark:text-purple-300">
                  💡 {metadata.recommendation}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Total generation time: <span className="font-mono font-semibold">{metadata.totalTimeSeconds}s</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {results && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">Comparison Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.map((result, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                    <CardTitle className="text-lg">{result.technique}</CardTitle>
                    <CardDescription>{result.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {result.error ? (
                      <div className="p-8 text-center text-red-500">
                        <p className="font-semibold">Generation Failed</p>
                        <p className="text-sm mt-2">{result.error}</p>
                      </div>
                    ) : result.imageUrl ? (
                      <div className="relative group">
                        <img
                          src={result.imageUrl}
                          alt={result.technique}
                          className="w-full aspect-square object-cover"
                          data-testid={`img-result-${index}`}
                        />
                        <Button
                          onClick={() => downloadImage(result.imageUrl!, result.technique)}
                          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          size="sm"
                          variant="secondary"
                          data-testid={`button-download-${index}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                          <div className="flex justify-between items-end text-white text-sm">
                            <div>
                              <p className="font-semibold">Expected Likeness</p>
                              <p>{result.likenessExpected}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">Strength</p>
                              <p className="font-mono">{result.strength}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!results && !isGenerating && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Upload className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Upload a photo and describe your scene to begin testing</p>
          </div>
        )}
      </div>
    </div>
  );
}
