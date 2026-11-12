import * as React from "react"

import { cn } from "@/lib/utils"

// Mobile UA sniff — ONLY used to drop `autoFocus`, so the keyboard doesn't
// pop (and shove the layout) the moment a step mounts on a phone.
const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, autoFocus, ...props }, ref) => {
    // The old "readOnly until tapped + blur on focus" hack is GONE
    // (launch audit 2026-10-06, P1): it made every field untypeable for
    // external keyboards, switch access and screen-reader focus-then-type,
    // skipped iOS autofill, and announced "read only". iOS zoom is stopped
    // by the 16px font below (text-base on phones), not by readOnly.
    return (
      <input
        type={type}
        className={cn(
          // Keeper skin (2026-07-09): taller h-12, rounded-xl, hairline
          // border on white, soft violet focus ring. text-base (16px) on
          // phones is load-bearing — below 16px iOS zooms on focus.
          "flex h-12 w-full rounded-xl border border-keeper-hair bg-white px-4 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-keeper-ink placeholder:text-keeper-meta/70 focus-visible:outline-none focus-visible:border-keeper-gold focus-visible:ring-2 focus-visible:ring-keeper-gold/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        autoFocus={isMobile ? false : autoFocus}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
