import { useState, useEffect } from "react";

interface TypingAnimationProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export function TypingAnimation({ text, speed = 20, onComplete }: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (currentIndex < text.length && isTyping) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else if (currentIndex >= text.length && isTyping) {
      setIsTyping(false);
      if (onComplete) {
        // Delay the completion callback slightly to ensure smooth animation
        setTimeout(onComplete, 50);
      }
    }
  }, [currentIndex, text, speed, onComplete, isTyping]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText("");
    setCurrentIndex(0);
    setIsTyping(true);
  }, [text]);

  return (
    <div className="whitespace-pre-wrap">
      {displayedText}
      {isTyping && currentIndex < text.length && (
        <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1" />
      )}
    </div>
  );
}