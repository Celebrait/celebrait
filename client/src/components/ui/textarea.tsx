import * as React from "react"

import { cn } from "@/lib/utils"

// Mobile UA sniff — ONLY used to drop `autoFocus` (see input.tsx).
const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, autoFocus, ...props }, ref) => {
  // No readOnly-until-tapped hack (launch audit 2026-10-06, P1) — it
  // blocked keyboard/assistive typing outright. 16px text stops iOS zoom.
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      autoFocus={isMobile ? false : autoFocus}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
