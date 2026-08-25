import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConceptoFacturable, Periodo, ResultadoCalculo, TramoPrecio } from '@/types'

export interface CalculationResult {
  concepto_id: string
  cantidad: number
  precio_aplicado: number
}

interface ReporteRowDb {
  clave: string
  guias: number
}

interface FisRowDb {
  guias_fis: number | null
}

interface EtiquetasRowDb {
  etiquetas: number
}

async function fetchAll<T>(supabase: SupabaseClient, table: string, periodoId: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq('periodo_id', periodoId)
  if (error) throw new Error(`Error al cargar ${table}: ${error.message}`)
  return (data ?? []) as T[]
}

export async function calculatePeriodo(
  periodoId: string,
  supabase: SupabaseClient
): Promise<CalculationResult[]> {
  const { data: conceptosData, error: conceptosError } = await supabase
    .from('conceptos_facturables')
    .select('*')
    .order('orden', { ascending: true })

  if (conceptosError) throw new Error(`Error al cargar conceptos_facturables: ${conceptosError.message}`)
  const conceptos = (conceptosData ?? []) as ConceptoFacturable[]

  const c03 = conceptos.find((c) => c.codigo === 'C03') ?? null

  const tramosPromise = c03
    ? supabase.from('tramos_precio').select('*').eq('concepto_id', c03.id).order('guia_min', { ascending: true })
    : null

  const periodoPromise = supabase.from('periodos_liquidacion').select('*').eq('id', periodoId).single()

  const [
    tramosResult,
    periodoResult,
    reporteRows,
    fisRows,
    comercializadorasRows,
    art40Rows,
    dpaRows,
    rectificacionesRows,
    hallazgosRows,
    pasajerosRows,
    etiquetasRows,
    existingResultados,
  ] = await Promise.all([
    tramosPromise,
    periodoPromise,
    fetchAll<ReporteRowDb>(supabase, 'reporte_sistema', periodoId),
    fetchAll<FisRowDb>(supabase, 'hoja_fis', periodoId),
    fetchAll<Record<string, unknown>>(supabase, 'hoja_comercializadoras', periodoId),
    fetchAll<Record<string, unknown>>(supabase, 'hoja_art40', periodoId),
    fetchAll<Record<string, unknown>>(supabase, 'hoja_dpa', periodoId),
    fetchAll<Record<string, unknown>>(supabase, 'hoja_rectificaciones', periodoId),
    fetchAll<Record<string, unknown>>(supabase, 'hoja_hallazgos', periodoId),
    fetchAll<Record<string, unknown>>(supabase, 'hoja_pasajeros', periodoId),
    fetchAll<EtiquetasRowDb>(supabase, 'hoja_etiquetas', periodoId),
    fetchAll<ResultadoCalculo>(supabase, 'resultados_calculo', periodoId),
  ])

  if (tramosResult?.error) throw new Error(`Error al cargar tramos_precio: ${tramosResult.error.message}`)
  const tramos = (tramosResult?.data ?? []) as TramoPrecio[]

  if (periodoResult.error) throw new Error(`Error al cargar el período: ${periodoResult.error.message}`)
  const periodo = periodoResult.data as Periodo

  const existingByConceptoId = new Map(existingResultados.map((r) => [r.concepto_id, r]))

  const results: CalculationResult[] = []

  for (const concepto of conceptos) {
    switch (concepto.codigo) {
      case 'C01': {
        const guiasIndCons = reporteRows
          .filter((r) => r.clave === 'IND' || r.clave === 'CONS')
          .reduce((sum, r) => sum + (r.guias ?? 0), 0)
        const guiasFisTotal = fisRows.reduce((sum, r) => sum + (r.guias_fis ?? 0), 0)
        results.push({
          concepto_id: concepto.id,
          cantidad: Math.max(0, guiasIndCons - guiasFisTotal),
          precio_aplicado: concepto.precio_unitario,
        })
        break
      }

      case 'C02': {
        const cantidad = reporteRows.filter((r) => r.clave === 'GLO').length
        results.push({ concepto_id: concepto.id, cantidad, precio_aplicado: concepto.precio_unitario })
        break
      }

      case 'C03': {
        const gloRows = reporteRows.filter((r) => r.clave === 'GLO')
        const totalExcedente = gloRows.reduce((sum, r) => sum + Math.max(0, (r.guias ?? 0) - 40), 0)

        if (totalExcedente === 0) {
          results.push({ concepto_id: concepto.id, cantidad: 0, precio_aplicado: 0 })
        } else {
          const tramo = tramos.find(
            (t) => t.guia_min <= totalExcedente && (t.guia_max === null || totalExcedente <= t.guia_max)
          )
          results.push({
            concepto_id: concepto.id,
            cantidad: totalExcedente,
            precio_aplicado: tramo?.precio_unitario ?? 0,
          })
        }
        break
      }

      case 'C17': {
        const guiasFisSum = fisRows.reduce((sum, r) => sum + (r.guias_fis ?? 0), 0)
        const cantidad = Math.max(0, guiasFisSum - (periodo.descuento_guias_fis ?? 0))
        results.push({ concepto_id: concepto.id, cantidad, precio_aplicado: concepto.precio_unitario })
        break
      }

      case 'C19': {
        results.push({
          concepto_id: concepto.id,
          cantidad: comercializadorasRows.length,
          precio_aplicado: concepto.precio_unitario,
        })
        break
      }

      case 'C22': {
        results.push({
          concepto_id: concepto.id,
          cantidad: art40Rows.length,
          precio_aplicado: concepto.precio_unitario,
        })
        break
      }

      case 'C26': {
        results.push({
          concepto_id: concepto.id,
          cantidad: dpaRows.length,
          precio_aplicado: concepto.precio_unitario,
        })
        break
      }

      case 'C27': {
        results.push({
          concepto_id: concepto.id,
          cantidad: rectificacionesRows.length,
          precio_aplicado: concepto.precio_unitario,
        })
        break
      }

      case 'C28': {
        results.push({
          concepto_id: concepto.id,
          cantidad: hallazgosRows.length,
          precio_aplicado: concepto.precio_unitario,
        })
        break
      }

      case 'C30': {
        results.push({
          concepto_id: concepto.id,
          cantidad: pasajerosRows.length,
          precio_aplicado: concepto.precio_unitario,
        })
        break
      }

      case 'C31': {
        const cantidad = etiquetasRows.reduce((sum, r) => sum + (r.etiquetas ?? 0), 0)
        results.push({ concepto_id: concepto.id, cantidad, precio_aplicado: concepto.precio_unitario })
        break
      }

      default: {
        console.log(`[calc] ${concepto.codigo} precio_unitario from DB:`, concepto.precio_unitario)
        // manual_directo concepts: preserve an admin override if one exists, otherwise blank.
        const existing = existingByConceptoId.get(concepto.id)
        if (existing && existing.override_admin) {
          results.push({
            concepto_id: concepto.id,
            cantidad: existing.cantidad,
            precio_aplicado: existing.precio_aplicado,
          })
        } else {
          results.push({ concepto_id: concepto.id, cantidad: 0, precio_aplicado: concepto.precio_unitario })
        }
        break
      }
    }
  }

  return results
}
