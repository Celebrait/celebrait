import { useState, useEffect, useMemo } from "react";

interface TypingAnimationProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export function TypingAnimation({ text, speed = 30, onComplete }: TypingAnimationProps) {
  const [displayedChunks, setDisplayedChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  // Split text into smart chunks (words with punctuation handling)
  const textChunks = useMemo(() => {
    // Split by spaces but preserve punctuation and line breaks
    const chunks = text.split(/(\s+|\n)/).filter(chunk => chunk.length > 0);
    return chunks;
  }, [text]);

  useEffect(() => {
    if (currentChunkIndex < textChunks.length && isTyping) {
      const timeout = setTimeout(() => {
        setDisplayedChunks(prev => [...prev, textChunks[currentChunkIndex]]);
        setCurrentChunkIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else if (currentChunkIndex >= textChunks.length && isTyping) {
      setIsTyping(false);
      if (onComplete) {
        // Immediate completion for faster button appearance
        setTimeout(onComplete, 10);
      }
    }
  }, [currentChunkIndex, textChunks, speed, onComplete, isTyping]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedChunks([]);
    setCurrentChunkIndex(0);
    setIsTyping(true);
  }, [text]);

  return (
    <div className="whitespace-pre-wrap">
      {displayedChunks.join('')}
      {isTyping && currentChunkIndex < textChunks.length && (
        <span className="inline-block w-0.5 h-5 bg-gray-600 animate-pulse ml-0.5" />
      )}
    </div>
  );
}