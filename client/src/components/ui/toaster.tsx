import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

// Per-variant icon + colour chip. The surface stays warm white; the chip
// carries the semantic colour from the brand palette (no SaaS-red). The
// `destructive` alias maps to the same dusty-red error treatment as
// `error` so the ~46 existing destructive call sites need no changes.
type ToastVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "destructive"

const VARIANT_ICON: Record<ToastVariant, { Icon: LucideIcon; chip: string }> = {
  default: { Icon: Info, chip: "bg-brand-light text-brand-dark" },
  info: { Icon: Info, chip: "bg-brand-light text-brand-dark" },
  success: { Icon: CheckCircle2, chip: "bg-cta-light text-cta-hover" },
  warning: { Icon: AlertTriangle, chip: "bg-accent-amber-light text-accent-amber-dark" },
  error: { Icon: AlertCircle, chip: "bg-accent-red-light text-accent-red-dark" },
  destructive: { Icon: AlertCircle, chip: "bg-accent-red-light text-accent-red-dark" },
}

// Auto-dismiss timing by intent. Errors + warnings linger so they can be
// read; confirmations clear quickly. Anything carrying an action button
// (e.g. "card ready → View it") holds longest so the action isn't lost.
function durationFor(variant: ToastVariant, hasAction: boolean): number {
  if (hasAction) return 10000
  if (variant === "error" || variant === "destructive" || variant === "warning")
    return 8000
  return 4000
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, duration, ...props }) {
        const v = (variant ?? "default") as ToastVariant
        const { Icon, chip } = VARIANT_ICON[v] ?? VARIANT_ICON.default
        return (
          <Toast
            key={id}
            variant={variant}
            duration={duration ?? durationFor(v, Boolean(action))}
            {...props}
          >
            <span
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                chip
              )}
              aria-hidden
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {action && <div className="mt-2 flex">{action}</div>}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
