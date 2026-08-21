import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAuth } from '@/hooks/useAuth'
import { parseTablaLiqFDX, type ParsedTablaLiqFDX } from '@/lib/excelParser'

export type SheetStatusState = 'pending' | 'loading' | 'success' | 'error'

export type SheetArrayKey = Exclude<keyof ParsedTablaLiqFDX, 'totalGuiasFis' | 'totalEtiquetas'>

export interface SheetStatus {
  key: SheetArrayKey
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

const EXISTING_DATA_PROBE_TABLE = 'hoja_comercializadoras'

function initialStatuses(parsed?: ParsedTablaLiqFDX): SheetStatus[] {
  return SHEET_CONFIG.map((sheet) => ({
    key: sheet.key,
    label: sheet.label,
    table: sheet.table,
    rowCount: parsed ? parsed[sheet.key].length : 0,
    status: 'pending',
  }))
}

export function useCargarArchivos() {
  const { user } = useAuth()
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedTablaLiqFDX | null>(null)
  const [sheetStatuses, setSheetStatuses] = useState<SheetStatus[]>(initialStatuses())
  const [isInserting, setIsInserting] = useState(false)

  const parseFile = useCallback(async (file: File) => {
    const parsed = await parseTablaLiqFDX(file)
    setParsedData(parsed)
    setSheetStatuses(initialStatuses(parsed))
    return parsed
  }, [])

  const reset = useCallback(() => {
    setParsedData(null)
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
    if (!parsedData || !selectedPeriodoId) return

    setIsInserting(true)
    const results: SheetStatus[] = []

    for (const sheet of SHEET_CONFIG) {
      setSheetStatuses((prev) =>
        prev.map((s) => (s.key === sheet.key ? { ...s, status: 'loading', error: undefined } : s))
      )

      const rows = parsedData[sheet.key]
      let result: SheetStatus

      try {
        const { error: deleteError } = await supabase
          .from(sheet.table)
          .delete()
          .eq('periodo_id', selectedPeriodoId)

        if (deleteError) {
          console.error(`Delete failed for ${sheet.table}:`, deleteError)
          throw deleteError
        }

        if (rows.length > 0) {
          const rowsWithPeriodo = rows.map((row) => ({ ...row, periodo_id: selectedPeriodoId }))
          const { error: insertError } = await supabase.from(sheet.table).insert(rowsWithPeriodo)
          if (insertError) throw insertError
        }

        result = {
          key: sheet.key,
          label: sheet.label,
          table: sheet.table,
          rowCount: rows.length,
          status: 'success',
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido'
        result = {
          key: sheet.key,
          label: sheet.label,
          table: sheet.table,
          rowCount: rows.length,
          status: 'error',
          error: message,
        }
      }

      results.push(result)
      setSheetStatuses((prev) => prev.map((s) => (s.key === sheet.key ? result : s)))
    }

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
  }, [parsedData, selectedPeriodoId, user])

  return {
    selectedPeriodoId,
    setSelectedPeriodoId,
    parsedData,
    parseFile,
    insertData,
    checkExistingData,
    reset,
    sheetStatuses,
    isInserting,
  }
}
