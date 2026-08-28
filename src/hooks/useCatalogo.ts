import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ConceptoFacturable, TramoPrecio } from '@/types'

const CONCEPTOS_ADMIN_QUERY_KEY = ['conceptos-admin']
const TRAMOS_ADMIN_QUERY_KEY = ['tramos-admin']
const CONCEPTOS_QUERY_KEY = ['conceptos']

export function useConceptosAdmin() {
  return useQuery({
    queryKey: CONCEPTOS_ADMIN_QUERY_KEY,
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

export function useTramosAdmin() {
  return useQuery({
    queryKey: TRAMOS_ADMIN_QUERY_KEY,
    queryFn: async (): Promise<TramoPrecio[]> => {
      const { data: conceptos, error: conceptosError } = await supabase
        .from('conceptos_facturables')
        .select('id, codigo')

      if (conceptosError) throw conceptosError

      const c03 = (conceptos ?? []).find((c) => c.codigo === 'C03')
      if (!c03) return []

      const { data, error } = await supabase
        .from('tramos_precio')
        .select('*')
        .eq('concepto_id', c03.id)
        .order('guia_min', { ascending: true })
        .returns<TramoPrecio[]>()

      if (error) throw error
      return data ?? []
    },
  })
}

export interface UpdateConceptoInput {
  id: string
  precio_unitario?: number
  activo?: boolean
}

export function useUpdateConcepto() {
  const queryClient = useQueryClient()

  return useMutation<ConceptoFacturable, PostgrestError, UpdateConceptoInput>({
    mutationFn: async ({ id, ...changes }) => {
      const { data, error } = await supabase
        .from('conceptos_facturables')
        .update(changes)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ConceptoFacturable
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONCEPTOS_ADMIN_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CONCEPTOS_QUERY_KEY })
    },
  })
}

export interface AddConceptoInput {
  codigo: string
  descripcion: string
  precio_unitario: number
  activo: boolean
}

export function useAddConcepto() {
  const queryClient = useQueryClient()

  return useMutation<ConceptoFacturable, PostgrestError, AddConceptoInput>({
    mutationFn: async (input) => {
      const { data: maxOrdenRows, error: maxOrdenError } = await supabase
        .from('conceptos_facturables')
        .select('orden')
        .order('orden', { ascending: false })
        .limit(1)

      if (maxOrdenError) throw maxOrdenError

      const nextOrden = ((maxOrdenRows?.[0]?.orden as number | undefined) ?? 0) + 1

      const { data, error } = await supabase
        .from('conceptos_facturables')
        .insert({
          codigo: input.codigo,
          descripcion: input.descripcion,
          tipo_calculo: 'manual_directo',
          precio_unitario: input.precio_unitario,
          orden: nextOrden,
          activo: input.activo,
        })
        .select()
        .single()

      if (error) throw error
      return data as ConceptoFacturable
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONCEPTOS_ADMIN_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CONCEPTOS_QUERY_KEY })
    },
  })
}

export interface UpdateTramoInput {
  id: string
  precio_unitario: number
}

export function useUpdateTramo() {
  const queryClient = useQueryClient()

  return useMutation<TramoPrecio, PostgrestError, UpdateTramoInput>({
    mutationFn: async ({ id, ...changes }) => {
      const { data, error } = await supabase
        .from('tramos_precio')
        .update(changes)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as TramoPrecio
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAMOS_ADMIN_QUERY_KEY })
    },
  })
}
