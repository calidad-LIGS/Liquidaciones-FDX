import type { BadgeProps } from '@/components/ui/badge'
import type { EstadoPeriodo } from '@/types'

export const ESTADO_BADGE: Record<EstadoPeriodo, { label: string; variant: BadgeProps['variant'] }> = {
  borrador: { label: 'Borrador', variant: 'muted' },
  en_revision: { label: 'En revisión', variant: 'warning' },
  cerrado: { label: 'Cerrado', variant: 'success' },
}

const ESTADO_ORDER: EstadoPeriodo[] = ['borrador', 'en_revision', 'cerrado']

export function nextEstado(current: EstadoPeriodo): EstadoPeriodo | null {
  const index = ESTADO_ORDER.indexOf(current)
  if (index === -1 || index === ESTADO_ORDER.length - 1) return null
  return ESTADO_ORDER[index + 1]
}
