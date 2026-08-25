import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAuth } from '@/hooks/useAuth'
import {
  parseReporteDelSistema,
  parseTablaLiqFDX,
  type ParsedTablaLiqFDX,
  type ReporteRow,
} from '@/lib/excelParser'

export type SheetStatusState = 'pending' | 'loading' | 'success' | 'error'

export type SheetArrayKey = Exclude<keyof ParsedTablaLiqFDX, 'totalGuiasFis' | 'totalEtiquetas'>
export type SheetStatusKey = SheetArrayKey | 'reporte_sistema'

export interface SheetStatus {
  key: SheetStatusKey
  label: string
  table: string
  rowCount: number
  status: SheetStatusState
  error?: string
}

interface SheetConfig {
  key: SheetArrayKey
  label: string
  table: string
}

const SHEET_CONFIG: SheetConfig[] = [
  { key: 'comercializadoras', label: 'Comercializadoras', table: 'hoja_comercializadoras' },
  { key: 'etiquetas', label: 'Etiquetas', table: 'hoja_etiquetas' },
  { key: 'art40', label: 'Art. 40', table: 'hoja_art40' },
  { key: 'pasajeros', label: 'Pasajeros', table: 'hoja_pasajeros' },
  { key: 'fis', label: 'Fis', table: 'hoja_fis' },
  { key: 'dpa', label: 'DPA', table: 'hoja_dpa' },
  { key: 'hallazgos', label: 'Hallazgos', table: 'hoja_hallazgos' },
  { key: 'rectificaciones', label: 'Rectificaciones', table: 'hoja_rectificaciones' },
]

const REPORTE_SHEET = {
  key: 'reporte_sistema' as const,
  label: 'Reporte del Sistema',
  table: 'reporte_sistema',
}

const EXISTING_DATA_PROBE_TABLE = 'hoja_comercializadoras'

function initialStatuses(parsed?: ParsedTablaLiqFDX | null, reporte?: ReporteRow[] | null): SheetStatus[] {
  const tablaStatuses: SheetStatus[] = SHEET_CONFIG.map((sheet) => ({
    key: sheet.key,
    label: sheet.label,
    table: sheet.table,
    rowCount: parsed ? parsed[sheet.key].length : 0,
    status: 'pending',
  }))

  const reporteStatus: SheetStatus = {
    key: REPORTE_SHEET.key,
    label: REPORTE_SHEET.label,
    table: REPORTE_SHEET.table,
    rowCount: reporte ? reporte.length : 0,
    status: 'pending',
  }

  return [...tablaStatuses, reporteStatus]
}

async function deleteAndInsertRows(
  table: string,
  rows: Record<string, unknown>[],
  periodoId: string
): Promise<{ error: string | null }> {
  const { error: deleteError } = await supabase.from(table).delete().eq('periodo_id', periodoId)

  if (deleteError) {
    console.error(`Delete failed for ${table}:`, deleteError)
    return { error: deleteError.message }
  }

  if (rows.length > 0) {
    const rowsWithPeriodo = rows.map((row) => ({ ...row, periodo_id: periodoId }))
    const { error: insertError } = await supabase.from(table).insert(rowsWithPeriodo)
    if (insertError) return { error: insertError.message }
  }

  return { error: null }
}

export function useCargarArchivos() {
  const { user } = useAuth()
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedTablaLiqFDX | null>(null)
  const [reporteData, setReporteData] = useState<ReporteRow[] | null>(null)
  const [sheetStatuses, setSheetStatuses] = useState<SheetStatus[]>(initialStatuses())
  const [isInserting, setIsInserting] = useState(false)

  const parseFile = useCallback(async (file: File) => {
    const parsed = await parseTablaLiqFDX(file)
    setParsedData(parsed)
    setSheetStatuses((prev) => {
      const tablaStatuses: SheetStatus[] = SHEET_CONFIG.map((sheet) => ({
        key: sheet.key,
        label: sheet.label,
        table: sheet.table,
        rowCount: parsed[sheet.key].length,
        status: 'pending',
      }))
      const reporteEntry = prev.find((s) => s.key === REPORTE_SHEET.key) ?? {
        key: REPORTE_SHEET.key,
        label: REPORTE_SHEET.label,
        table: REPORTE_SHEET.table,
        rowCount: 0,
        status: 'pending' as const,
      }
      return [...tablaStatuses, reporteEntry]
    })
    return parsed
  }, [])

  const parseReporteFile = useCallback(async (file: File) => {
    const rows = await parseReporteDelSistema(file)
    setReporteData(rows)
    setSheetStatuses((prev) => {
      const reporteEntry: SheetStatus = {
        key: REPORTE_SHEET.key,
        label: REPORTE_SHEET.label,
        table: REPORTE_SHEET.table,
        rowCount: rows.length,
        status: 'pending',
      }
      return [...prev.filter((s) => s.key !== REPORTE_SHEET.key), reporteEntry]
    })
    return rows
  }, [])

  const reset = useCallback(() => {
    setParsedData(null)
    setReporteData(null)
    setSheetStatuses(initialStatuses())
  }, [])

  const checkExistingData = useCallback(async (periodoId: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from(EXISTING_DATA_PROBE_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('periodo_id', periodoId)

    if (error) throw error
    return (count ?? 0) > 0
  }, [])

  const insertData = useCallback(async () => {
    if (!parsedData || !reporteData || !selectedPeriodoId) return

    setIsInserting(true)
    const results: SheetStatus[] = []

    for (const sheet of SHEET_CONFIG) {
      setSheetStatuses((prev) =>
        prev.map((s) => (s.key === sheet.key ? { ...s, status: 'loading', error: undefined } : s))
      )

      const rows = parsedData[sheet.key]
      const { error } = await deleteAndInsertRows(
        sheet.table,
        rows as unknown as Record<string, unknown>[],
        selectedPeriodoId
      )

      const result: SheetStatus = error
        ? { key: sheet.key, label: sheet.label, table: sheet.table, rowCount: rows.length, status: 'error', error }
        : { key: sheet.key, label: sheet.label, table: sheet.table, rowCount: rows.length, status: 'success' }

      results.push(result)
      setSheetStatuses((prev) => prev.map((s) => (s.key === sheet.key ? result : s)))
    }

    // Reporte del Sistema is inserted last, after all TablaLiqFDX sheets.
    setSheetStatuses((prev) =>
      prev.map((s) => (s.key === REPORTE_SHEET.key ? { ...s, status: 'loading', error: undefined } : s))
    )

    const { error: reporteError } = await deleteAndInsertRows(
      REPORTE_SHEET.table,
      reporteData as unknown as Record<string, unknown>[],
      selectedPeriodoId
    )

    const reporteResult: SheetStatus = reporteError
      ? {
          key: REPORTE_SHEET.key,
          label: REPORTE_SHEET.label,
          table: REPORTE_SHEET.table,
          rowCount: reporteData.length,
          status: 'error',
          error: reporteError,
        }
      : {
          key: REPORTE_SHEET.key,
          label: REPORTE_SHEET.label,
          table: REPORTE_SHEET.table,
          rowCount: reporteData.length,
          status: 'success',
        }

    results.push(reporteResult)
    setSheetStatuses((prev) => prev.map((s) => (s.key === REPORTE_SHEET.key ? reporteResult : s)))

    setIsInserting(false)

    const totalInserted = results
      .filter((r) => r.status === 'success')
      .reduce((sum, r) => sum + r.rowCount, 0)
    const failedSheets = results.filter((r) => r.status === 'error')

    if (failedSheets.length === 0) {
      const { error: periodoUpdateError } = await supabase
        .from('periodos_liquidacion')
        .update({
          ultima_carga_at: new Date().toISOString(),
          ultima_carga_by: user?.id ?? null,
        })
        .eq('id', selectedPeriodoId)

      if (periodoUpdateError) {
        toast.error('Los datos se cargaron, pero no se pudo actualizar el registro del período.')
      } else {
        toast.success(`Se insertaron ${totalInserted} filas correctamente.`)
      }
    } else {
      toast.error(`${failedSheets.length} hoja(s) fallaron. Se insertaron ${totalInserted} filas del resto.`)
    }
  }, [parsedData, reporteData, selectedPeriodoId, user])

  return {
    selectedPeriodoId,
    setSelectedPeriodoId,
    parsedData,
    reporteData,
    parseFile,
    parseReporteFile,
    insertData,
    checkExistingData,
    reset,
    sheetStatuses,
    isInserting,
  }
}
