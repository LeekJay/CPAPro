import type {
  ComponentProps,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SyntheticEvent,
} from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { ChevronDownIcon } from "lucide-react"
import styles from "./Collapsible/Collapsible.module.scss"

interface LegacyCollapsibleProps extends HTMLAttributes<HTMLDetailsElement> {
  label: ReactNode
  hint?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onToggle?: (event: SyntheticEvent<HTMLDetailsElement>) => void
  flush?: boolean
}

type CollapsibleProps =
  | ComponentProps<typeof CollapsiblePrimitive.Root>
  | PropsWithChildren<LegacyCollapsibleProps>

function isLegacyCollapsibleProps(
  props: CollapsibleProps
): props is PropsWithChildren<LegacyCollapsibleProps> {
  return "label" in props || "hint" in props || "flush" in props
}

function Collapsible(props: CollapsibleProps) {
  if (isLegacyCollapsibleProps(props)) {
    const {
      label,
      hint,
      defaultOpen = false,
      open,
      onToggle,
      flush,
      children,
      className,
      ...rest
    } = props
    const detailsProps = open !== undefined ? { open } : { defaultOpen }
    const cls = [styles.root, className].filter(Boolean).join(" ")
    const contentCls = flush ? styles.contentFlush : styles.content

    return (
      <details className={cls} onToggle={onToggle} {...detailsProps} {...rest}>
        <summary className={styles.summary}>
          <span className={styles.summaryLabel}>
            <span>{label}</span>
            {hint ? <span className={styles.summaryHint}>{hint}</span> : null}
          </span>
          <span className={styles.chevron} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </summary>
        <div className={contentCls}>{children}</div>
      </details>
    )
  }

  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
