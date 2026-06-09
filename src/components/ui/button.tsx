import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"
import { Slot } from "radix-ui"

import { buttonVariants, type ButtonVariantProps } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

function Button({
  children,
  className,
  variant = "default",
  size = "default",
  asChild = false,
  fullWidth = false,
  loading = false,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  ButtonVariantProps & {
    asChild?: boolean
    fullWidth?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const loader = loading ? (
    <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
  ) : null
  const slottedChildren =
    asChild && loader && React.isValidElement(children)
      ? React.cloneElement(
          children,
          undefined,
          loader,
          (children.props as { children?: React.ReactNode }).children
        )
      : children

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), fullWidth && "w-full", className)}
      disabled={disabled || loading}
      {...props}
    >
      {asChild ? (
        slottedChildren
      ) : (
        <>
          {loader}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button }
