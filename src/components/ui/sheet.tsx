import * as React from "react"
import { createPortal } from "react-dom"
import { Dialog as SheetPrimitive } from "radix-ui"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"
import { FOCUSABLE_SELECTOR, lockScroll, unlockScroll } from "@/components/ui/scrollLock"
import legacyStyles from "./Sheet/Sheet.module.scss"

export type SheetSize = "md" | "lg" | "xl"

interface LegacySheetProps {
  open: boolean
  onClose: () => void
  size?: SheetSize
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  closeDisabled?: boolean
  className?: string
  ariaLabel?: string
  confirmClose?: () => boolean | Promise<boolean>
  children?: React.ReactNode
}

type SheetRootProps = React.ComponentProps<typeof SheetPrimitive.Root>
type SheetProps = SheetRootProps | LegacySheetProps

const CLOSE_ANIMATION_DURATION = 280
const SIZE_CLASS: Record<SheetSize, string> = {
  md: legacyStyles.sizeMd,
  lg: legacyStyles.sizeLg,
  xl: legacyStyles.sizeXl,
}

function isLegacySheetProps(props: SheetProps): props is LegacySheetProps {
  return "onClose" in props
}

function LegacySheet({
  open,
  onClose,
  size = "md",
  eyebrow,
  title,
  description,
  footer,
  closeDisabled = false,
  className,
  ariaLabel,
  confirmClose,
  children,
}: LegacySheetProps) {
  const { t } = useTranslation()
  const titleId = React.useId()
  const descId = React.useId()
  const [isVisible, setIsVisible] = React.useState(false)
  const [isClosing, setIsClosing] = React.useState(false)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const sheetRef = React.useRef<HTMLDivElement | null>(null)
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null)
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null)

  const getFocusableElements = React.useCallback(() => {
    if (!sheetRef.current) return [] as HTMLElement[]
    return Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1)
  }, [])

  const startClose = React.useCallback(
    (notifyParent: boolean) => {
      if (closeTimerRef.current !== null) return
      setIsClosing(true)
      closeTimerRef.current = window.setTimeout(() => {
        setIsVisible(false)
        setIsClosing(false)
        closeTimerRef.current = null
        if (notifyParent) {
          onClose()
        }
      }, CLOSE_ANIMATION_DURATION)
    },
    [onClose]
  )

  React.useEffect(() => {
    let cancelled = false

    if (open) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      queueMicrotask(() => {
        if (cancelled) return
        setIsVisible(true)
        setIsClosing(false)
      })
    } else if (isVisible) {
      queueMicrotask(() => {
        if (cancelled) return
        startClose(false)
      })
    }

    return () => {
      cancelled = true
    }
  }, [open, isVisible, startClose])

  const handleClose = React.useCallback(async () => {
    if (confirmClose) {
      try {
        const ok = await confirmClose()
        if (ok === false) return
      } catch {
        return
      }
    }
    startClose(true)
  }, [confirmClose, startClose])

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const shouldLockScroll = open || isVisible

  React.useEffect(() => {
    if (!shouldLockScroll) return
    lockScroll()
    return () => unlockScroll()
  }, [shouldLockScroll])

  React.useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const timer = window.setTimeout(() => {
      const first = getFocusableElements()[0]
      ;(first ?? closeBtnRef.current ?? sheetRef.current)?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [getFocusableElements, open])

  React.useEffect(() => {
    if (open || isVisible) return
    previouslyFocusedRef.current?.focus()
    previouslyFocusedRef.current = null
  }, [isVisible, open])

  React.useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (closeDisabled) return
        event.preventDefault()
        handleClose()
        return
      }
      if (event.key !== "Tab") return
      const focusables = getFocusableElements()
      if (focusables.length === 0) {
        event.preventDefault()
        sheetRef.current?.focus()
        return
      }
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey) {
        if (active === firstEl || active === sheetRef.current) {
          event.preventDefault()
          lastEl.focus()
        }
        return
      }
      if (active === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [closeDisabled, getFocusableElements, handleClose, open])

  if (!open && !isVisible) return null

  const stateClass = isClosing ? legacyStyles.exiting : legacyStyles.entering
  const overlayCls = `${legacyStyles.overlay} ${stateClass}`.trim()
  const contentCls = [legacyStyles.content, SIZE_CLASS[size], stateClass, className]
    .filter(Boolean)
    .join(" ")

  const content = (
    <div
      className={overlayCls}
      role="presentation"
      onMouseDown={(event) => {
        if (closeDisabled) return
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      <div
        ref={sheetRef}
        className={contentCls}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={!title && ariaLabel ? ariaLabel : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className={legacyStyles.closeBtn}
          onClick={closeDisabled ? undefined : handleClose}
          disabled={closeDisabled}
          aria-label={t("common.close")}
        >
          <XIcon />
        </button>
        {(eyebrow || title || description) && (
          <div className={legacyStyles.header}>
            {eyebrow ? <div className={legacyStyles.eyebrow}>{eyebrow}</div> : null}
            {title ? (
              <h2 id={titleId} className={legacyStyles.title}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descId} className={legacyStyles.description}>
                {description}
              </p>
            ) : null}
          </div>
        )}
        <div className={legacyStyles.body}>{children}</div>
        {footer ? <div className={legacyStyles.footer}>{footer}</div> : null}
      </div>
    </div>
  )

  if (typeof document === "undefined") return content
  return createPortal(content, document.body)
}

function Sheet(props: SheetProps) {
  if (isLegacySheetProps(props)) {
    return <LegacySheet {...props} />
  }

  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
