import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { EstadoPeriodo, Periodo } from '@/types'

const PERIODOS_TABLE = 'periodos_liquidacion'
const PERIODOS_QUERY_KEY = ['periodos']

export function useListPeriodos() {
  return useQuery({
    queryKey: PERIODOS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(PERIODOS_TABLE)
        .select('*')
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
        .returns<Periodo[]>()

      if (error) throw error
      return data
    },
  })
}

export interface CreatePeriodoInput {
  mes: number
  anio: number
}

export function useCreatePeriodo() {
  const queryClient = useQueryClient()

  return useMutation<Periodo, PostgrestError, CreatePeriodoInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from(PERIODOS_TABLE)
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as Periodo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERIODOS_QUERY_KEY })
    },
  })
}

export interface UpdatePeriodoInput {
  id: string
  estado?: EstadoPeriodo
  anticipo_periodo_anterior?: number
  descuento_guias_fis?: number
  notas?: string | null
}

export function useUpdatePeriodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...changes }: UpdatePeriodoInput) => {
      const { data, error } = await supabase
        .from(PERIODOS_TABLE)
        .update(changes)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Periodo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERIODOS_QUERY_KEY })
    },
  })
}
