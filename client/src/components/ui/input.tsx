import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, autoFocus, ...props }, ref) => {
    const [userInteracted, setUserInteracted] = React.useState(false);
    
    // Detect mobile device
    const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    return (
      <input
        type={type}
        className={cn(
          // Keeper skin (2026-07-09): taller h-12, rounded-xl, hairline
          // border on white, soft violet focus ring. (The mobile-readonly
          // hack below is preserved as-is — a separate follow-up.)
          "flex h-12 w-full rounded-xl border border-keeper-hair bg-white px-4 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-keeper-ink placeholder:text-keeper-meta/70 focus-visible:outline-none focus-visible:border-keeper-gold focus-visible:ring-2 focus-visible:ring-keeper-gold/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        autoFocus={isMobile ? false : autoFocus} // Prevent auto-focus on mobile
        readOnly={isMobile && !userInteracted} // Make readonly until user interacts on mobile
        {...props}
        onTouchStart={() => {
          if (isMobile) {
            setUserInteracted(true);
          }
        }}
        onClick={(e) => {
          if (isMobile && !userInteracted) {
            setUserInteracted(true);
            // Remove readonly and focus after user interaction
            setTimeout(() => {
              if (e.currentTarget && e.currentTarget.readOnly) {
                e.currentTarget.readOnly = false;
                e.currentTarget.focus();
              }
            }, 50);
          }
          props.onClick?.(e);
        }}
        onFocus={(e) => {
          if (isMobile && !userInteracted) {
            e.currentTarget.blur(); // Prevent focus if user hasn't interacted
            return;
          }
          props.onFocus?.(e);
        }}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
