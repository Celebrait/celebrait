import { Button } from "@/components/ui/button";
import logoSrc from "../assets/Logo2.png";

export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <img 
              src={logoSrc} 
              alt="Celebrait Logo" 
              className="h-16 object-contain"
            />
          </div>
          

          
          <div className="flex items-center space-x-4">
            <span className="bg-gradient-celebrait text-white px-6 py-2 rounded-xl shadow-lg">
              BETA Version
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
