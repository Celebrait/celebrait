import { useEffect, useRef, useState } from 'react';

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationRef = useRef<number>();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);

  // Progressive reveal animation like ChatGPT
  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(0, 0, width, height);

    if (!finalImageUrl || !imageLoaded || !imageRef.current) {
      // Loading state
      if (isGenerating || progress > 0) {
        // Animated loading dots
        const time = Date.now() / 1000;
        const dots = 3;
        
        ctx.fillStyle = '#64748b';
        ctx.font = '16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AI is creating your image', width / 2, height / 2 - 20);
        
        // Animated dots
        for (let i = 0; i < dots; i++) {
          const opacity = Math.abs(Math.sin(time * 2 + i * 0.5));
          ctx.fillStyle = `rgba(100, 116, 139, ${opacity})`;
          ctx.beginPath();
          ctx.arc(width / 2 - 20 + i * 20, height / 2 + 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Progress bar
        const barWidth = width * 0.6;
        const barHeight = 4;
        const barX = (width - barWidth) / 2;
        const barY = height / 2 + 40;
        
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(barX, barY, (progress / 100) * barWidth, barHeight);
      } else {
        // Idle state
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ready to generate', width / 2, height / 2);
      }
    } else {
      // Progressive reveal of the image (ChatGPT style)
      const image = imageRef.current;
      
      // Calculate reveal height based on progress
      const targetReveal = Math.min(1, Math.max(0, (progress - 50) / 50)); // Start revealing at 50% progress
      
      // Smooth animation
      const revealSpeed = 0.03;
      const newReveal = revealProgress + (targetReveal - revealProgress) * revealSpeed;
      setRevealProgress(newReveal);
      
      const revealHeight = height * newReveal;
      
      if (revealHeight > 0) {
        // Save context for clipping
        ctx.save();
        
        // Create clipping path for progressive reveal
        ctx.beginPath();
        ctx.rect(0, 0, width, revealHeight);
        ctx.clip();
        
        // Draw the image
        ctx.drawImage(image, 0, 0, width, height);
        
        // Restore context
        ctx.restore();
        
        // Add scanning line effect at the reveal edge
        if (newReveal < 1 && revealHeight > 5) {
          const scanY = revealHeight;
          
          // Glowing scan line
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 10;
          
          ctx.beginPath();
          ctx.moveTo(0, scanY);
          ctx.lineTo(width, scanY);
          ctx.stroke();
          
          // Reset shadow
          ctx.shadowBlur = 0;
          
          // Add sparkle effects near scan line
          const time = Date.now() / 200;
          for (let i = 0; i < 5; i++) {
            const x = (width / 5) * i + 10 + Math.sin(time + i) * 15;
            const y = scanY - 5 + Math.cos(time * 1.5 + i) * 3;
            const sparkleSize = 1 + Math.sin(time * 2 + i) * 1;
            
            ctx.fillStyle = '#10b981';
            ctx.globalAlpha = 0.6 + Math.sin(time * 3 + i) * 0.3;
            ctx.beginPath();
            ctx.arc(x, y, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      
      // Completion check mark when fully revealed
      if (newReveal >= 0.98 && progress >= 95) {
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(width - 25, 25, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Check mark
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(width - 30, 25);
        ctx.lineTo(width - 25, 30);
        ctx.lineTo(width - 18, 20);
        ctx.stroke();
      }
    }

    // Continue animation if needed
    if (isGenerating || revealProgress < 1 || progress < 100) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  // Load image when URL is provided
  useEffect(() => {
    if (finalImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageRef.current = img;
        setImageLoaded(true);
      };
      img.onerror = () => {
        console.warn('Failed to load image:', finalImageUrl);
        setImageLoaded(false);
      };
      img.src = finalImageUrl;
    } else {
      setImageLoaded(false);
      imageRef.current = null;
    }
  }, [finalImageUrl]);

  // Start animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Restart animation when key props change
  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  }, [progress, isGenerating, imageLoaded, finalImageUrl]);

  return (
    <div className={`relative inline-block ${className}`} data-testid={`progressive-canvas-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="rounded-lg shadow-lg border border-gray-200 bg-gray-50"
      />
      
      {/* Title overlay */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
        {title}
      </div>
      
      {/* Progress indicator */}
      {(isGenerating || progress < 100) && (
        <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
}