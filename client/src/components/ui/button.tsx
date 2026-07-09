import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Keeper skin (2026-07-09): pill shape (rounded-full), GREEN "go" default
// (cta), VIOLET (keeper-gold) for links + focus rings. Dimensions are
// unchanged so nothing reflows — only shape + colour move. Two-role
// palette: green = actions, violet = accent, ink = text.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keeper-gold/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary "go" — green pill.
        default: "bg-go text-go-foreground hover:bg-go-hover shadow-sm",
        // The one system-red, for true failures only.
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Hairline secondaries on translucent white — the Keeper card feel.
        outline:
          "border border-keeper-hair bg-white/70 text-keeper-ink hover:bg-keeper-gold-wash",
        secondary:
          "border border-keeper-hair bg-white/70 text-keeper-ink hover:bg-keeper-gold-wash",
        ghost: "text-keeper-ink hover:bg-keeper-gold-wash",
        // Links carry the violet accent.
        link: "text-keeper-gold underline-offset-4 hover:text-keeper-gold-deep hover:underline",
      },
      size: {
        // Same heights/paddings as before — rounded-full inherited from the
        // base, so every size reads as a pill without changing size.
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
