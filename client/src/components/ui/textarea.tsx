import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, autoFocus, ...props }, ref) => {
  const [userInteracted, setUserInteracted] = React.useState(false);
  
  // Detect mobile device
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
})
Textarea.displayName = "Textarea"

export { Textarea }
