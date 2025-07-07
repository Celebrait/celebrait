import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <img 
              src="/images/Logo.png" 
              alt="Celebrait Logo" 
              className="h-10 object-contain"
            />
          </div>
          

          
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
