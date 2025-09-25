import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileImage, Zap, CheckCircle, AlertTriangle, XCircle, Eye, Camera } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PhotoAssessment {
  photoIndex: number;
  qualityScore: number;
  rating: string;
  usableForGeneration: boolean;
  recommendation: string;
  detailedAnalysis: string;
  timestamp: string;
}

interface AssessmentSummary {
  averageScore: number;
  totalPhotos: number;
  usablePhotos: number;
  recommendation: string;
}

export function PhotoQualityTest() {
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [assessments, setAssessments] = useState<PhotoAssessment[]>([]);
  const [summary, setSummary] = useState<AssessmentSummary | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    console.log("[PHOTO_QUALITY_TEST] File upload triggered, file count:", files.length);
    
    if (files.length === 0) {
      console.log("[PHOTO_QUALITY_TEST] No files selected");
      return;
    }

    try {
      console.log("[PHOTO_QUALITY_TEST] Converting files to base64...");
      // Convert files to base64
      const photoPromises = files.map((file, index) => {
        console.log(`[PHOTO_QUALITY_TEST] Processing file ${index + 1}: ${file.name} (${file.size} bytes)`);
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            console.log(`[PHOTO_QUALITY_TEST] File ${index + 1} converted to base64`);
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const photoDataUrls = await Promise.all(photoPromises);
      console.log("[PHOTO_QUALITY_TEST] All files converted, setting state with", photoDataUrls.length, "photos");
      
      setUploadedPhotos(photoDataUrls);
      setAssessments([]);
      setSummary(null);
      setAssessmentComplete(false);
      
      console.log("[PHOTO_QUALITY_TEST] State updated, showing toast");
      toast({
        title: "Photos uploaded",
        description: `${files.length} photos ready for quality assessment`
      });
    } catch (error) {
      console.error("[PHOTO_QUALITY_TEST] Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to process uploaded photos",
        variant: "destructive"
      });
    }
  };

  const assessPhotoQuality = async () => {
    if (uploadedPhotos.length === 0) return;

    console.log("[PHOTO_QUALITY_TEST] Starting assessment for", uploadedPhotos.length, "photos");
    
    setIsAssessing(true);
    try {
      console.log("[PHOTO_QUALITY_TEST] Making API request to /api/assess-photo-quality");
      const response = await apiRequest("POST", "/api/assess-photo-quality", {
        images: uploadedPhotos
      });

      console.log("[PHOTO_QUALITY_TEST] Response status:", response.status);
      const result = await response.json();
      console.log("[PHOTO_QUALITY_TEST] Response data:", result);
      
      if (result.success) {
        setAssessments(result.assessments);
        setSummary(result.summary);
        setAssessmentComplete(true);
        
        toast({
          title: "Assessment complete",
          description: `Quality analysis finished for ${result.assessments.length} photos`
        });
      } else {
        throw new Error(result.error || 'Assessment failed');
      }
    } catch (error: any) {
      toast({
        title: "Assessment failed",
        description: error.message || "Failed to assess photo quality",
        variant: "destructive"
      });
    } finally {
      setIsAssessing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 6) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 4) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getRatingIcon = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'excellent': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'good': return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'fair': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'poor': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Eye className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Photo Quality Assessment</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload photos to get AI-powered quality assessment for greeting card character generation.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Photos for Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAssessing}
              className="w-full max-w-md"
            >
              <FileImage className="w-4 h-4 mr-2" />
              Choose Photos (Multiple OK)
            </Button>
            <p className="text-sm text-gray-500">
              Select one or more photos to assess their suitability for AI character generation
            </p>
          </div>

          {/* Uploaded Photos Preview */}
          {uploadedPhotos.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Uploaded Photos ({uploadedPhotos.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                {uploadedPhotos.map((photo, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden bg-gray-50">
                    <img 
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-2 text-center">
                      <span className="text-sm font-medium">Photo {index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={assessPhotoQuality}
                disabled={isAssessing}
                className="w-full"
                size="lg"
              >
                {isAssessing ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-spin" />
                    Assessing Quality...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Assess Photo Quality
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Results */}
      {summary && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Overall Assessment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{summary.averageScore}/10</div>
                <div className="text-sm text-gray-600">Average Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.usablePhotos}/{summary.totalPhotos}</div>
                <div className="text-sm text-gray-600">Usable Photos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{Math.round((summary.usablePhotos / summary.totalPhotos) * 100)}%</div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
            </div>
            
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Recommendation:</strong> {summary.recommendation}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Individual Photo Assessments */}
      {assessments.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Individual Photo Assessments</h2>
          
          {assessments.map((assessment, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {getRatingIcon(assessment.rating)}
                    Photo {assessment.photoIndex}
                  </span>
                  <Badge className={getScoreColor(assessment.qualityScore)}>
                    {assessment.qualityScore}/10 - {assessment.rating}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Photo Preview */}
                  <div>
                    <img 
                      src={uploadedPhotos[index]}
                      alt={`Photo ${assessment.photoIndex}`}
                      className="w-full h-48 object-cover border rounded-lg"
                    />
                  </div>
                  
                  {/* Quality Metrics */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Quality Score</span>
                        <span className="text-sm font-bold">{assessment.qualityScore}/10</span>
                      </div>
                      <Progress value={assessment.qualityScore * 10} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Rating:</span>
                        <span className="text-sm font-medium">{assessment.rating}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Usable for AI:</span>
                        <span className={`text-sm font-medium ${assessment.usableForGeneration ? 'text-green-600' : 'text-red-600'}`}>
                          {assessment.usableForGeneration ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recommendation */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                    <p className="text-sm text-gray-700 mb-4">{assessment.recommendation}</p>
                    
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        View Detailed Analysis
                      </summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <pre className="whitespace-pre-wrap text-xs">{assessment.detailedAnalysis}</pre>
                      </div>
                    </details>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quality Assessment Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Face Quality (Most Important)</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Face should be sharp and in focus</li>
                <li>• Good size - not too small or large</li>
                <li>• Frontal or 3/4 view works best</li>
                <li>• Even lighting on face</li>
                <li>• Eyes clearly visible</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Technical Quality</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• High resolution and detail</li>
                <li>• Sharp focus overall</li>
                <li>• Natural color balance</li>
                <li>• Low noise/grain</li>
                <li>• Good exposure</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Composition</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Single person preferred</li>
                <li>• Clear, unobstructed face</li>
                <li>• Simple background</li>
                <li>• No hands covering face</li>
                <li>• Good framing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}