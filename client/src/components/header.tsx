import { Heart, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-soft-cream/90 backdrop-blur-sm border-b-4 border-quirky-purple sticky top-0 z-50 quirky-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-quirky-gradient rounded-full flex items-center justify-center quirky-shadow animate-wiggle">
              <Sparkles className="text-white text-xl animate-bounce-gentle" fill="currentColor" />
            </div>
            <span className="text-3xl font-bold text-charcoal-soft font-['Comic_Neue'] transform -rotate-1">
              Celebrait ✨
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button className="bg-pastel-purple hover:bg-quirky-purple text-charcoal-soft font-semibold px-6 py-3 hand-drawn-btn border-2 border-quirky-purple font-['Comic_Neue']">
              Sign In
            </Button>
            <Button variant="ghost" size="sm" className="md:hidden hand-drawn-btn">
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
