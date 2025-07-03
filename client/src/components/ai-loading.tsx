import { Brain, Cpu } from 'lucide-react';

interface AILoadingProps {
  message?: string;
}

export default function AILoading({ message = "Processing..." }: AILoadingProps) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-8">
          {/* Main AI brain icon with modern styling */}
          <div className="w-24 h-24 bg-gradient-modern rounded-3xl mx-auto flex items-center justify-center shadow-2xl glow-effect animate-pulse-glow">
            <Brain className="w-12 h-12 text-white" />
          </div>
          
          {/* Neural network rings */}
          <div className="absolute inset-0 w-24 h-24 mx-auto">
            <div className="w-full h-full border-4 border-border/30 border-t-cyber-purple rounded-full animate-spin" style={{animationDuration: '2s'}}></div>
          </div>
          <div className="absolute inset-2 w-20 h-20 mx-auto">
            <div className="w-full h-full border-2 border-border/20 border-r-electric-blue rounded-full animate-spin" style={{animationDuration: '3s', animationDirection: 'reverse'}}></div>
          </div>
          
          {/* Processing indicator */}
          <div className="absolute -top-3 -right-3 w-8 h-8 bg-neon-green rounded-full flex items-center justify-center animate-pulse">
            <Cpu className="w-4 h-4 text-white" />
          </div>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-heading text-foreground">Neural Network Active</h3>
          <p className="text-muted-foreground text-body">{message}</p>
          
          {/* Processing dots animation */}
          <div className="flex justify-center space-x-2 mt-6">
            <div className="w-2 h-2 bg-cyber-purple rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
            <div className="w-2 h-2 bg-electric-blue rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
          </div>
        </div>
      </div>
    </div>
  );
}