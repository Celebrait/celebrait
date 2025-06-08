import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Eye, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GeneratedImage {
  id: string;
  frontImage: string;
  insideImage?: string;
  prompt: string;
  style: string;
  cardText?: string;
  timestamp: number;
}

export default function Gallery() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Load images from localStorage
    const savedImages = localStorage.getItem('celebrait-gallery');
    if (savedImages) {
      try {
        const parsed = JSON.parse(savedImages);
        setImages(parsed.sort((a: GeneratedImage, b: GeneratedImage) => b.timestamp - a.timestamp));
      } catch (error) {
        console.error('Error loading gallery:', error);
      }
    }
  }, []);

  const downloadImage = (imageData: string, filename: string) => {
    try {
      // Convert base64 to blob for proper download
      const base64Data = imageData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Download Started',
        description: 'Your image is being downloaded'
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Error',
        description: 'Failed to download image',
        variant: 'destructive'
      });
    }
  };

  const clearGallery = () => {
    localStorage.removeItem('celebrait-gallery');
    setImages([]);
    toast({
      title: 'Gallery Cleared',
      description: 'All saved images have been removed'
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (images.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Image Gallery</h1>
          <p className="text-muted-foreground">
            Your generated images will appear here. Create some cards to build your gallery!
          </p>
        </div>
        
        <div className="text-center py-12">
          <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No images in your gallery yet</p>
          <p className="text-gray-400">Generate some cards to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Image Gallery</h1>
          <p className="text-muted-foreground">
            View and download your generated images ({images.length} total)
          </p>
        </div>
        <Button onClick={clearGallery} variant="outline">
          Clear Gallery
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.map((image) => (
          <Card key={image.id} className="overflow-hidden">
            <div className="aspect-square">
              <img 
                src={image.frontImage} 
                alt="Generated card" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium line-clamp-2">
                {image.cardText || image.prompt}
              </CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {formatDate(image.timestamp)}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground mb-3">
                <p><strong>Style:</strong> {image.style}</p>
                {image.prompt && (
                  <p className="line-clamp-2"><strong>Scene:</strong> {image.prompt}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => downloadImage(image.frontImage, `front-${image.id}.png`)}
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Front
                </Button>
                {image.insideImage && (
                  <Button 
                    onClick={() => downloadImage(image.insideImage!, `inside-${image.id}.png`)}
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Inside
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}