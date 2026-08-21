import * as React from 'react'

interface CollapsibleContextValue {
  open: boolean
  toggle: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleContext(): CollapsibleContextValue {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error('Collapsible components must be used within <Collapsible>')
  return ctx
}

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children: React.ReactNode
}

function Collapsible({ open: controlledOpen, defaultOpen = false, onOpenChange, className, children }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const toggle = React.useCallback(() => {
    const next = !open
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }, [open, isControlled, onOpenChange])

  return (
    <CollapsibleContext.Provider value={{ open, toggle }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggle, open } = useCollapsibleContext()
  return (
    <button type="button" onClick={toggle} aria-expanded={open} className={className} {...props}>
      {children}
    </button>
  )
}

function CollapsibleContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { open } = useCollapsibleContext()
  if (!open) return null
  return <div className={className}>{children}</div>
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
