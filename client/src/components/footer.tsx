import { Link } from "wouter";
import logoSrc from "../assets/logo-mark.webp";
import { CONTROLLER } from "@/lib/legal";

// Footer used on the legal pages (privacy / terms). UK identity — the
// full registered entity lives on the legal pages themselves via
// lib/legal.ts; here we show the brand + a neutral copyright so there's
// no placeholder text on screen. (Was the stale SA entity + .co.za
// socials — audit 2026-07-02.)
export default function Footer() {
  return (
    <footer className="bg-white/80 backdrop-blur-sm border-t border-purple-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-4">
          <img src={logoSrc} alt="Celebrait Logo" className="h-14 object-contain" />
        </div>
        <p className="text-slate-gray text-sm max-w-md">
          Personalised greeting cards for the moments that matter, one
          celebration at a time.
        </p>

        <div className="border-t border-purple-100 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-slate-gray text-sm">
              © 2026 {CONTROLLER.tradingAs}. Made with ❤️ in the UK. All rights
              reserved.
            </p>
            <div className="flex space-x-4 text-sm">
              <Link href="/privacy-policy" className="text-slate-gray hover:text-ethereal-purple transition-colors">
                Privacy Policy
              </Link>
              <span className="text-slate-gray">•</span>
              <Link href="/terms-of-service" className="text-slate-gray hover:text-ethereal-purple transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
