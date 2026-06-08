import type { ComponentProps, CSSProperties } from "react"
import { cn } from "@/lib/utils"

type SkeletonProps = ComponentProps<"div"> & {
  width?: number | string
  height?: number | string
  rounded?: number | string
}

function Skeleton({
  className,
  style,
  width,
  height,
  rounded,
  ...props
}: SkeletonProps) {
  const mergedStyle: CSSProperties = {
    ...style,
    width: width ?? style?.width,
    height: height ?? style?.height,
    borderRadius: rounded ?? style?.borderRadius,
  }

  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      style={mergedStyle}
      {...props}
    />
  )
}

export { Skeleton }
