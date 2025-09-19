import { useEffect, useRef, useState, useCallback } from 'react';

interface ProgressiveImageCanvasProps {
  width?: number;
  height?: number;
  finalImageUrl?: string;
  progress: number; // 0-100
  isGenerating: boolean;
  title: string;
  className?: string;
}

export default function ProgressiveImageCanvas({ 
  width = 400, 
  height = 300, 
  finalImageUrl, 
  progress, 
  isGenerating,
  title,
  className = ""
}: ProgressiveImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finalImageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number>();
  const [noiseData, setNoiseData] = useState<ImageData | null>(null);

  // Create noise pattern
  const generateNoise = useCallback((ctx: CanvasRenderingContext2D) => {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random();
      // Create colored noise that looks like AI thinking
      data[i] = Math.floor(noise * 120 + 60);     // Red
      data[i + 1] = Math.floor(noise * 100 + 80); // Green  
      data[i + 2] = Math.floor(noise * 140 + 100); // Blue
      data[i + 3] = Math.floor(noise * 60 + 30);   // Alpha
    }
    
    return imageData;
  }, [width, height]);

  // Progressive reveal animation
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, width, height);
    
    if (!isGenerating && progress < 5) {
      // Show empty state
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#d1d5db';
      ctx.strokeRect(0, 0, width, height);
      
      // Show placeholder text
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Preparing AI generation...', width / 2, height / 2);
      return;
    }

    if (isGenerating || (!finalImageUrl && progress > 0)) {
      // Stage 1: Noise/static (0-15%)
      if (progress < 15) {
        if (!noiseData) {
          setNoiseData(generateNoise(ctx));
        } else {
          ctx.putImageData(noiseData, 0, 0);
        }
        
        // Add scanning line effect
        const scanY = (progress / 15) * height;
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      
      // Stage 2: Rough shapes emerging (15-40%)
      else if (progress < 40) {
        // Create blurred/rough version
        ctx.filter = `blur(${Math.max(0, (40 - progress) / 25 * 15)}px)`;
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(0, 0, width, height);
        
        // Add some basic shapes/gradients to simulate rough composition
        const gradProgress = (progress - 15) / 25;
        
        ctx.globalAlpha = gradProgress * 0.6;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#f3e8ff');
        gradient.addColorStop(0.5, '#ddd6fe');
        gradient.addColorStop(1, '#c4b5fd');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
        
        // Add processing indicators
        ctx.fillStyle = '#8b5cf6';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎨 Building composition...', width / 2, height - 20);
      }
      
      // Stage 3: Details appearing (40-70%)
      else if (progress < 70) {
        // More defined shapes with less blur
        const blurAmount = Math.max(0, (70 - progress) / 30 * 8);
        ctx.filter = `blur(${blurAmount}px)`;
        
        // Create more detailed preview
        const detailProgress = (progress - 40) / 30;
        
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);
        
        // Add geometric shapes simulating image structure
        ctx.globalAlpha = 0.4 + detailProgress * 0.3;
        
        // Central focus area
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.3 * detailProgress;
        
        const focusGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        focusGradient.addColorStop(0, '#fbbf24');
        focusGradient.addColorStop(1, '#f59e0b');
        ctx.fillStyle = focusGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
        
        ctx.fillStyle = '#8b5cf6';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎯 Adding details...', width / 2, height - 20);
      }
      
      // Stage 4: Final details (70-100%)
      else {
        if (finalImageUrl && finalImageRef.current?.complete) {
          // Progressive reveal of final image
          const revealProgress = Math.min(1, (progress - 70) / 30);
          
          // Create a mask for progressive reveal
          ctx.save();
          
          // Reveal from top to bottom with some noise
          const revealHeight = height * revealProgress;
          
          ctx.beginPath();
          ctx.rect(0, 0, width, revealHeight);
          ctx.clip();
          
          ctx.drawImage(finalImageRef.current, 0, 0, width, height);
          
          ctx.restore();
          
          // Add scanning effect for the reveal line
          if (revealProgress < 1) {
            const scanLine = revealHeight;
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, scanLine);
            ctx.lineTo(width, scanLine);
            ctx.stroke();
            ctx.globalAlpha = 1;
            
            // Add particles effect at scan line
            for (let i = 0; i < 8; i++) {
              const x = (i / 7) * width + (Math.sin(Date.now() / 200 + i) * 5);
              const y = scanLine + (Math.cos(Date.now() / 150 + i) * 3);
              
              ctx.fillStyle = '#10b981';
              ctx.globalAlpha = 0.6;
              ctx.beginPath();
              ctx.arc(x, y, 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }
        } else {
          // Still processing final details
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(0, 0, width, height);
          
          ctx.fillStyle = '#8b5cf6';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✨ Finalizing masterpiece...', width / 2, height / 2);
        }
      }
      
      // Add progress bar
      const barHeight = 4;
      const barY = height - barHeight;
      
      // Background
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, barY, width, barHeight);
      
      // Progress
      const progressWidth = (progress / 100) * width;
      const progressGradient = ctx.createLinearGradient(0, 0, progressWidth, 0);
      progressGradient.addColorStop(0, '#8b5cf6');
      progressGradient.addColorStop(1, '#ec4899');
      ctx.fillStyle = progressGradient;
      ctx.fillRect(0, barY, progressWidth, barHeight);
      
    } else if (finalImageUrl && finalImageRef.current?.complete) {
      // Show final completed image
      ctx.drawImage(finalImageRef.current, 0, 0, width, height);
      
      // Add completion effect
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, width, height);
      
      // Completion badge
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(width - 20, 20, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓', width - 20, 24);
    }

    // Continue animation if generating
    if (isGenerating || progress < 100) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [width, height, finalImageUrl, progress, isGenerating, noiseData, generateNoise]);

  // Load final image when available
  useEffect(() => {
    if (finalImageUrl && !finalImageRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        finalImageRef.current = img;
      };
      img.src = finalImageUrl;
    }
  }, [finalImageUrl]);

  // Start animation
  useEffect(() => {
    animate();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  // Reset noise when starting new generation
  useEffect(() => {
    if (isGenerating && progress < 5) {
      setNoiseData(null);
    }
  }, [isGenerating, progress]);

  return (
    <div className={`relative ${className}`}>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="rounded-lg shadow-lg border border-gray-200"
        data-testid={`canvas-${title.toLowerCase().replace(/\s+/g, '-')}`}
      />
      
      {/* Title overlay */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
        {title}
      </div>
      
      {/* Progress percentage */}
      {progress > 0 && progress < 100 && (
        <div className="absolute top-2 right-2 bg-purple-500 text-white px-2 py-1 rounded text-xs font-bold">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
}