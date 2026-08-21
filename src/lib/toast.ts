type ToastVariant = 'success' | 'error'

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let listeners: Listener[] = []
let nextId = 0

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function push(message: string, variant: ToastVariant) {
  const id = ++nextId
  toasts = [...toasts, { id, message, variant }]
  emit()
  setTimeout(() => dismiss(id), 4000)
}

export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.push(listener)
  listener(toasts)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
