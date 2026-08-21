import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useUpdatePeriodo } from '@/hooks/usePeriodos'
import type { ConceptoFacturable, ResultadoCalculo } from '@/types'

const CONCEPTOS_QUERY_KEY = ['conceptos']
const RESULTADOS_QUERY_KEY = 'resultados'
const RESUMEN_CARGA_QUERY_KEY = 'resumen-carga'

export function useConceptos() {
  return useQuery({
    queryKey: CONCEPTOS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceptos_facturables')
        .select('*')
        .order('orden', { ascending: true })
        .returns<ConceptoFacturable[]>()

      if (error) throw error
      return data
    },
  })
}

export function useResultadosPeriodo(periodoId: string | null) {
  return useQuery({
    queryKey: [RESULTADOS_QUERY_KEY, periodoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resultados_calculo')
        .select('*')
        .eq('periodo_id', periodoId as string)
        .returns<ResultadoCalculo[]>()

      if (error) throw error
      return data
    },
    enabled: !!periodoId,
  })
}

export interface UpsertResultadoInput {
  periodo_id: string
  concepto_id: string
  cantidad: number
  precio_aplicado: number
  override_admin: boolean
  updated_by: string | null
}

export function useUpsertResultado() {
  const queryClient = useQueryClient()

  return useMutation<ResultadoCalculo, PostgrestError, UpsertResultadoInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('resultados_calculo')
        .upsert(input, { onConflict: 'periodo_id,concepto_id' })
        .select()
        .single()

      if (error) throw error
      return data as ResultadoCalculo
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [RESULTADOS_QUERY_KEY, variables.periodo_id] })
    },
  })
}

export function useUpdateEstadoPeriodo() {
  return useUpdatePeriodo()
}

export interface ResumenCarga {
  comercializadoras: number
  etiquetas: number
  art40: number
  pasajeros: number
  fis: number
  dpa: number
  hallazgos: number
  rectificaciones: number
}

async function countRows(table: string, periodoId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('periodo_id', periodoId)

  if (error) {
    console.error(`Count query failed for ${table}:`, error)
    return 0
  }
  // count comes from the response's Content-Range header (e.g. "*/42"), not data.length —
  // with head: true, no row data is returned at all.
  return count ?? 0
}

async function sumColumn(table: string, column: string, periodoId: string): Promise<number> {
  const { data, error } = await supabase.from(table).select(column).eq('periodo_id', periodoId)

  if (error) {
    console.error(`Sum query failed for ${table}.${column}:`, error)
    return 0
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return rows.reduce((sum, row) => sum + (Number(row[column]) || 0), 0)
}

export function useResumenCarga(periodoId: string | null) {
  return useQuery({
    queryKey: [RESUMEN_CARGA_QUERY_KEY, periodoId],
    queryFn: async (): Promise<ResumenCarga> => {
      const pid = periodoId as string

      const [comercializadoras, etiquetas, art40, pasajeros, fis, dpa, hallazgos, rectificaciones] =
        await Promise.all([
          countRows('hoja_comercializadoras', pid),
          sumColumn('hoja_etiquetas', 'etiquetas', pid),
          countRows('hoja_art40', pid),
          countRows('hoja_pasajeros', pid),
          sumColumn('hoja_fis', 'guias_fis', pid),
          countRows('hoja_dpa', pid),
          countRows('hoja_hallazgos', pid),
          countRows('hoja_rectificaciones', pid),
        ])

      return { comercializadoras, etiquetas, art40, pasajeros, fis, dpa, hallazgos, rectificaciones }
    },
    enabled: !!periodoId,
  })
}

const SHEET_TABLES = {
  comercializadoras: 'hoja_comercializadoras',
  etiquetas: 'hoja_etiquetas',
  art40: 'hoja_art40',
  pasajeros: 'hoja_pasajeros',
  fis: 'hoja_fis',
  dpa: 'hoja_dpa',
  hallazgos: 'hoja_hallazgos',
  rectificaciones: 'hoja_rectificaciones',
}

export type SheetTableKey = keyof typeof SHEET_TABLES

export function useHojaData(sheetKey: SheetTableKey, periodoId: string | null, enabled: boolean) {
  const table = SHEET_TABLES[sheetKey]

  return useQuery({
    queryKey: ['hoja-data', table, periodoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('periodo_id', periodoId as string)
        .limit(500)

      if (error) throw error
      return data as Record<string, unknown>[]
    },
    enabled: enabled && !!periodoId,
  })
}
