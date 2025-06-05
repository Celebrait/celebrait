import { Heart, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-celebrait rounded-xl flex items-center justify-center">
              <Heart className="text-white text-lg" fill="currentColor" />
            </div>
            <span className="text-2xl font-bold text-gradient-celebrait">Celebrait</span>
          </div>
          
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-slate-gray hover:text-ethereal-purple transition-colors">How it works</a>
            <a href="#" className="text-slate-gray hover:text-ethereal-purple transition-colors">Gallery</a>
            <a href="#" className="text-slate-gray hover:text-ethereal-purple transition-colors">Pricing</a>
            <a href="/test" className="text-slate-gray hover:text-ethereal-purple transition-colors">Test Lab</a>
            <a href="/style-transform" className="text-slate-gray hover:text-ethereal-purple transition-colors">Style Transform</a>
          </nav>
          
          <div className="flex items-center space-x-4">
            <Button className="bg-gradient-celebrait hover:opacity-90 text-white px-6 py-2 rounded-xl shadow-lg transition-all duration-300">
              Sign In
            </Button>
            <Button variant="ghost" size="sm" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
