import { Heart, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="glass-effect border-b border-border/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-modern rounded-2xl flex items-center justify-center shadow-lg glow-effect">
                <Heart className="text-white text-xl" fill="currentColor" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-neon-green rounded-full animate-pulse-glow" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-gradient-primary text-display">Celebrait</span>
              <span className="text-xs text-muted-foreground text-label tracking-wider">AI GREETING CARDS</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button className="btn-primary interactive-button">
              <Sparkles className="w-4 h-4 mr-2" />
              Create Card
            </Button>
            <Button variant="ghost" size="sm" className="md:hidden text-foreground hover:bg-muted rounded-xl">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
