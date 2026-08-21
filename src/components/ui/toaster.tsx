import { useEffect, useState } from 'react'
import { subscribeToasts, type ToastItem } from '@/lib/toast'
import { cn } from '@/lib/utils'

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => subscribeToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'rounded-md border px-4 py-3 text-sm shadow-lg bg-card',
            t.variant === 'success' ? 'border-success/30 text-success' : 'border-destructive/30 text-destructive'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
