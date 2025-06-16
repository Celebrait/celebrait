import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    console.log('Route changed to:', location);
    
    const scrollToTop = () => {
      console.log('Attempting to scroll to top');
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      console.log('Scroll position after:', window.pageYOffset || document.documentElement.scrollTop);
    };

    // Try multiple approaches to ensure scrolling works
    scrollToTop();
    
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      scrollToTop();
    });

    // Also try with a slight delay
    const timeoutId = setTimeout(() => {
      scrollToTop();
    }, 10);

    return () => clearTimeout(timeoutId);
  }, [location]);

  return null;
}