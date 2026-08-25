import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { calculatePeriodo } from '@/lib/calculationEngine'

export function useRunCalculation(periodoId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const runCalculation = useCallback(async () => {
    if (!periodoId) return

    setIsCalculating(true)
    setError(null)

    try {
      const results = await calculatePeriodo(periodoId, supabase)

      const { data: existingData, error: existingError } = await supabase
        .from('resultados_calculo')
        .select('concepto_id, override_admin')
        .eq('periodo_id', periodoId)

      if (existingError) throw existingError

      const overriddenConceptoIds = new Set(
        (existingData ?? []).filter((r) => r.override_admin).map((r) => r.concepto_id as string)
      )

      const rowsToUpsert = results
        .filter((r) => !overriddenConceptoIds.has(r.concepto_id))
        .map((r) => ({
          periodo_id: periodoId,
          concepto_id: r.concepto_id,
          cantidad: r.cantidad,
          precio_aplicado: r.precio_aplicado,
          override_admin: false,
          calculado_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        }))

      // Debug: concepto_id is a UUID, not the human-readable codigo, so resolve
      // C32/C33's real ids before filtering — a literal ['C32-id','C33-id'] filter
      // would never match anything.
      const { data: debugConceptos } = await supabase
        .from('conceptos_facturables')
        .select('id, codigo')
        .in('codigo', ['C32', 'C33'])
      const debugIds = (debugConceptos ?? []).map((c) => c.id as string)
      console.log('[upsert payload]', results.filter((r) => debugIds.includes(r.concepto_id)))

      if (rowsToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('resultados_calculo')
          .upsert(rowsToUpsert, { onConflict: 'periodo_id,concepto_id', ignoreDuplicates: false })

        if (upsertError) throw upsertError
      }

      await queryClient.invalidateQueries({ queryKey: ['resultados', periodoId] })
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error('Error desconocido al calcular')
      setError(normalized)
      throw normalized
    } finally {
      setIsCalculating(false)
    }
  }, [periodoId, user, queryClient])

  return { runCalculation, isCalculating, error }
}
