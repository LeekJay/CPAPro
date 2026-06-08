import * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<"input"> & {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  rightElement?: React.ReactNode
}

function Input({
  className,
  type,
  id,
  label,
  hint,
  error,
  rightElement,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy =
    [ariaDescribedBy, errorId, hintId].filter(Boolean).join(" ") || undefined
  const invalid = Boolean(error) || Boolean(ariaInvalid)
  const input = (
    <input
      id={inputId}
      type={type}
      data-slot="input"
      className={cn(
        rightElement && "pr-10",
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )

  if (!label && !hint && !error && !rightElement) {
    return input
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium leading-none">
          {label}
        </label>
      )}
      <div className="relative">
        {input}
        {rightElement && (
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
            {rightElement}
          </div>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export { Input }
