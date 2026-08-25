import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ConceptoFacturable, EstadoPeriodo, Factura, Periodo, ResultadoCalculo, TramoPrecio } from '@/types'

const FACTURA_DATA_QUERY_KEY = 'factura-data'
const PERIODOS_QUERY_KEY = ['periodos']

export interface FacturaData {
  periodo: Periodo
  conceptos: ConceptoFacturable[]
  resultados: ResultadoCalculo[]
  tramos: TramoPrecio[]
}

export function useFacturaData(periodoId: string | null) {
  return useQuery({
    queryKey: [FACTURA_DATA_QUERY_KEY, periodoId],
    queryFn: async (): Promise<FacturaData> => {
      const pid = periodoId as string

      const [periodoResult, conceptosResult, resultadosResult] = await Promise.all([
        supabase.from('periodos_liquidacion').select('*').eq('id', pid).single(),
        supabase.from('conceptos_facturables').select('*').order('orden', { ascending: true }),
        supabase.from('resultados_calculo').select('*').eq('periodo_id', pid),
      ])

      if (periodoResult.error) throw periodoResult.error
      if (conceptosResult.error) throw conceptosResult.error
      if (resultadosResult.error) throw resultadosResult.error

      const conceptos = (conceptosResult.data ?? []) as ConceptoFacturable[]
      const c03 = conceptos.find((c) => c.codigo === 'C03') ?? null

      const tramosResult = c03
        ? await supabase.from('tramos_precio').select('*').eq('concepto_id', c03.id).order('guia_min', { ascending: true })
        : { data: [], error: null }

      if (tramosResult.error) throw tramosResult.error

      return {
        periodo: periodoResult.data as Periodo,
        conceptos,
        resultados: (resultadosResult.data ?? []) as ResultadoCalculo[],
        tramos: (tramosResult.data ?? []) as TramoPrecio[],
      }
    },
    enabled: !!periodoId,
  })
}

function useUpdateEstadoPeriodo(periodoId: string | null, estado: EstadoPeriodo) {
  const queryClient = useQueryClient()

  return useMutation<Periodo, PostgrestError, void>({
    mutationFn: async () => {
      const pid = periodoId as string
      const { data, error } = await supabase
        .from('periodos_liquidacion')
        .update({ estado })
        .eq('id', pid)
        .select()
        .single()

      if (error) throw error
      return data as Periodo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERIODOS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: [FACTURA_DATA_QUERY_KEY, periodoId] })
    },
  })
}

export function useMarcarCerrado(periodoId: string | null) {
  return useUpdateEstadoPeriodo(periodoId, 'cerrado')
}

export function useReabrirPeriodo(periodoId: string | null) {
  return useUpdateEstadoPeriodo(periodoId, 'borrador')
}

export interface GuardarFacturaInput {
  subtotal: number
  iva: number
  total: number
  anticipo_aplicado: number
  total_a_pagar: number
}

export function useGuardarFactura(periodoId: string | null) {
  const queryClient = useQueryClient()

  return useMutation<Factura, PostgrestError, GuardarFacturaInput>({
    mutationFn: async (input) => {
      const pid = periodoId as string
      const { data, error } = await supabase
        .from('facturas')
        .upsert({ periodo_id: pid, ...input }, { onConflict: 'periodo_id' })
        .select()
        .single()

      if (error) throw error
      return data as Factura
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FACTURA_DATA_QUERY_KEY, periodoId] })
    },
  })
}
