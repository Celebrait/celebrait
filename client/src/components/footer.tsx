import { Heart, Instagram, Cpu, Zap } from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="glass-effect border-t border-border/20 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-10 h-10 bg-gradient-modern rounded-2xl flex items-center justify-center shadow-lg">
                <Heart className="text-white text-lg" fill="currentColor" />
              </div>
              <div>
                <span className="text-xl font-bold text-gradient-primary text-display">Celebrait</span>
                <div className="flex items-center space-x-2 mt-1">
                  <Cpu className="w-3 h-3 text-cyber-purple" />
                  <span className="text-xs text-muted-foreground text-label tracking-wider">AI-POWERED</span>
                  <Zap className="w-3 h-3 text-electric-blue" />
                </div>
              </div>
            </div>
            <p className="text-muted-foreground text-body mb-6 max-w-md">
              Creating magical moments through cutting-edge AI technology. 
              Every greeting card is uniquely generated using advanced machine learning models.
            </p>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-label text-muted-foreground">CONNECT:</span>
              <div className="flex space-x-3">
                <a 
                  href="https://www.instagram.com/celebrait.co.za/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center hover:bg-gradient-modern hover:border-transparent transition-all duration-300 interactive-button group"
                >
                  <Instagram className="w-4 h-4 text-muted-foreground group-hover:text-white" />
                </a>
                <a 
                  href="https://www.tiktok.com/@celebrait.co.za" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center hover:bg-gradient-modern hover:border-transparent transition-all duration-300 interactive-button group"
                >
                  <FaTiktok className="w-4 h-4 text-muted-foreground group-hover:text-white" />
                </a>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground text-heading mb-4">Technology</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyber-purple rounded-full" />
                <span className="text-muted-foreground text-body">GPT-4 Vision</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-electric-blue rounded-full" />
                <span className="text-muted-foreground text-body">FLUX Pro</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-neon-green rounded-full" />
                <span className="text-muted-foreground text-body">Custom AI Models</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border/30 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-muted-foreground text-sm text-body">
              © 2025 Wezign Media (PTY) LTD trading as Celebrait.co.za. Built in South Africa.
            </p>
            <div className="flex space-x-6 text-sm">
              <Link href="/privacy-policy" className="text-muted-foreground hover:text-foreground transition-colors text-body">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors text-body">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
