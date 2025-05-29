import { Heart, Instagram, Facebook, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white/80 backdrop-blur-sm border-t border-purple-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-celebrait rounded-lg flex items-center justify-center">
                <Heart className="text-white text-sm" fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-gradient-celebrait">Celebrait</span>
            </div>
            <p className="text-slate-gray text-sm">Creating magical moments through AI-powered greeting cards, one celebration at a time.</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Create</h4>
            <ul className="space-y-2 text-sm text-slate-gray">
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">Birthday Cards</a></li>
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">Love Cards</a></li>
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">Thank You Cards</a></li>
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">Just Because</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-slate-gray">
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">How It Works</a></li>
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">FAQs</a></li>
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-ethereal-purple transition-colors">Delivery Info</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Connect</h4>
            <div className="flex space-x-3">
              <a href="#" className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-ethereal-purple hover:text-white transition-all duration-300">
                <Instagram className="text-sm" />
              </a>
              <a href="#" className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-ethereal-purple hover:text-white transition-all duration-300">
                <Facebook className="text-sm" />
              </a>
              <a href="#" className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-ethereal-purple hover:text-white transition-all duration-300">
                <Twitter className="text-sm" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-purple-100 mt-8 pt-8 text-center">
          <p className="text-slate-gray text-sm">© 2024 Celebrait. Made with ❤️ in South Africa. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
