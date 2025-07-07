// This is a backup of the old home page content
// The functionality has been moved to /create-card

import { useEffect } from "react";
import { useLocation } from "wouter";

// Simple redirect component 
export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect old home page visitors to the new landing page
    setLocation("/");
  }, [setLocation]);

  return null;
}