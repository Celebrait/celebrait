import { Instagram, Facebook } from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { Link } from "wouter";
import logoSrc from "../assets/logo.png";

export default function Footer() {
  return (
    <footer className="bg-white/80 backdrop-blur-sm border-t border-purple-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center mb-4">
              <img 
                src={logoSrc} 
                alt="Celebrait Logo" 
                className="h-10 object-contain"
              />
            </div>
            <p className="text-slate-gray text-sm">Creating magical moments through AI-powered greeting cards, one celebration at a time.</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Connect</h4>
            <div className="flex space-x-3">
              <a href="https://www.instagram.com/celebrait.co.za/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-ethereal-purple hover:text-white transition-all duration-300">
                <Instagram className="text-sm" />
              </a>
              <a href="https://www.tiktok.com/@celebrait.co.za" target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-ethereal-purple hover:text-white transition-all duration-300">
                <FaTiktok className="text-sm" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-purple-100 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-slate-gray text-sm">
              © 2025 Wezign Media (PTY) LTD trading as Celebrait.co.za. Made with ❤️ in South Africa. All rights reserved.
            </p>
            <div className="flex space-x-4 text-sm">
              <Link href="/privacy-policy" className="text-slate-gray hover:text-ethereal-purple transition-colors">
                Privacy Policy
              </Link>
              <span className="text-slate-gray">•</span>
              <Link href="/terms-of-service" className="text-slate-gray hover:text-ethereal-purple transition-colors">
                Terms of Service
              </Link>
              <span className="text-slate-gray">•</span>
              <Link href="/test-dashboard" className="text-slate-gray hover:text-ethereal-purple transition-colors">
                Test Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
