import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useListPeriodos } from '@/hooks/usePeriodos'
import { useCargarArchivos, type SheetStatus, type SheetStatusState } from '@/hooks/useCargarArchivos'
import { toast } from '@/lib/toast'
import { formatPeriodo } from '@/lib/meses'
import { cn } from '@/lib/utils'
import type { ParsedTablaLiqFDX } from '@/lib/excelParser'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { AlertDialog } from '@/components/ui/alert-dialog'

const STATUS_LABEL: Record<SheetStatusState, string> = {
  pending: 'Pendiente',
  loading: 'Insertando…',
  success: 'Listo',
  error: 'Error',
}

const STATUS_BADGE_VARIANT: Record<SheetStatusState, BadgeProps['variant']> = {
  pending: 'muted',
  loading: 'warning',
  success: 'success',
  error: 'destructive',
}

function getSheetDisplayCount(sheet: SheetStatus, parsedData: ParsedTablaLiqFDX | null) {
  if (sheet.key === 'fis') return { count: parsedData?.totalGuiasFis ?? 0, label: 'guías FIS' }
  if (sheet.key === 'etiquetas') return { count: parsedData?.totalEtiquetas ?? 0, label: 'etiquetas' }
  return { count: sheet.rowCount, label: 'filas' }
}

interface UploadZoneProps {
  title: string
  dropLabel: string
  onProcess: (file: File) => Promise<unknown>
  statusLabel: string | null
}

function UploadZone({ title, dropLabel, onProcess, statusLabel }: UploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleProcess = async () => {
    if (!selectedFile) return
    setIsParsing(true)
    try {
      await onProcess(selectedFile)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo procesar el archivo.')
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        {selectedFile ? (
          <p className="text-sm text-foreground">{selectedFile.name}</p>
        ) : (
          <>
            <p className="text-sm text-foreground">{dropLabel}</p>
            <p className="text-sm text-muted-foreground">o haz clic para seleccionar un archivo .xlsx</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleProcess} disabled={!selectedFile || isParsing}>
          {isParsing ? 'Procesando…' : 'Procesar archivo'}
        </Button>
        {statusLabel && <Badge variant="success">{statusLabel}</Badge>}
      </div>
    </div>
  )
}

export default function CargarArchivosPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: periodos, isLoading: isLoadingPeriodos } = useListPeriodos()
  const {
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
  } = useCargarArchivos()

  const [isCheckingExisting, setIsCheckingExisting] = useState(false)
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false)
  const [resetCounter, setResetCounter] = useState(0)

  useEffect(() => {
    if (selectedPeriodoId) return
    const fromUrl = searchParams.get('periodo')
    if (fromUrl) setSelectedPeriodoId(fromUrl)
  }, [searchParams, selectedPeriodoId, setSelectedPeriodoId])

  const handleConfirmInsert = async () => {
    if (!selectedPeriodoId) return
    setIsCheckingExisting(true)
    try {
      const hasExisting = await checkExistingData(selectedPeriodoId)
      setIsCheckingExisting(false)
      if (hasExisting) {
        setIsReplaceConfirmOpen(true)
        return
      }
    } catch (error) {
      setIsCheckingExisting(false)
      toast.error(error instanceof Error ? error.message : 'No se pudo verificar datos existentes.')
      return
    }
    insertData()
  }

  const handleReplaceConfirmed = () => {
    setIsReplaceConfirmOpen(false)
    insertData()
  }

  const handleReset = () => {
    reset()
    setResetCounter((c) => c + 1)
  }

  const insertSucceeded =
    !isInserting && sheetStatuses.length > 0 && sheetStatuses.every((s) => s.status === 'success')

  const bothFilesReady = !!parsedData && !!reporteData
  const confirmDisabledReason = !selectedPeriodoId
    ? 'Selecciona un período'
    : !parsedData && !reporteData
      ? 'Procesa ambos archivos primero'
      : !parsedData
        ? 'Falta procesar el archivo TablaLiqFDX'
        : !reporteData
          ? 'Falta procesar el archivo Reporte del Sistema'
          : undefined

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Cargar Archivos</h1>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="periodo-select">Período</Label>
        <select
          id="periodo-select"
          value={selectedPeriodoId ?? ''}
          onChange={(event) => setSelectedPeriodoId(event.target.value || null)}
          disabled={isLoadingPeriodos}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Selecciona un período</option>
          {periodos?.map((periodo) => (
            <option key={periodo.id} value={periodo.id}>
              {formatPeriodo(periodo.mes, periodo.anio)}
            </option>
          ))}
        </select>
      </div>

      {insertSucceeded ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
          <h2 className="font-heading text-lg font-semibold text-foreground">Archivo cargado exitosamente</h2>

          <ul className="w-full max-w-sm divide-y divide-border text-left">
            {sheetStatuses.map((sheet) => {
              const { count, label } = getSheetDisplayCount(sheet, parsedData)
              return (
                <li key={sheet.key} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{sheet.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count} {label}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              Cargar otro archivo
            </Button>
            <Button onClick={() => navigate(`/resultados?periodo=${selectedPeriodoId}`)}>
              Ver resultados
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            <UploadZone
              key={`tabla-${resetCounter}`}
              title="TablaLiqFDX"
              dropLabel="Arrastra el archivo TablaLiqFDX aquí"
              onProcess={parseFile}
              statusLabel={parsedData ? `${parsedData.comercializadoras.length + parsedData.etiquetas.length + parsedData.art40.length + parsedData.pasajeros.length + parsedData.fis.length + parsedData.dpa.length + parsedData.hallazgos.length + parsedData.rectificaciones.length} filas en 8 hojas` : null}
            />

            <UploadZone
              key={`reporte-${resetCounter}`}
              title="Reporte del Sistema"
              dropLabel="Arrastra el archivo Reporte del Sistema aquí"
              onProcess={parseReporteFile}
              statusLabel={reporteData ? `${reporteData.length} filas` : null}
            />
          </div>

          {(parsedData || reporteData) && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Hojas</h2>

              <ul className="divide-y divide-border">
                {sheetStatuses.map((sheet) => {
                  const { count, label } = getSheetDisplayCount(sheet, parsedData)

                  return (
                    <li key={sheet.key} className="flex flex-col gap-1 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{sheet.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-sm text-muted-foreground">
                            {count} {label}
                          </span>
                          <Badge variant={STATUS_BADGE_VARIANT[sheet.status]}>
                            {STATUS_LABEL[sheet.status]}
                          </Badge>
                        </div>
                      </div>
                      {sheet.error && <p className="text-xs text-destructive">{sheet.error}</p>}
                    </li>
                  )
                })}
              </ul>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleConfirmInsert}
                  disabled={!selectedPeriodoId || !bothFilesReady || isInserting || isCheckingExisting}
                  title={confirmDisabledReason}
                >
                  {isInserting
                    ? 'Insertando…'
                    : isCheckingExisting
                      ? 'Verificando…'
                      : 'Confirmar e insertar'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={isReplaceConfirmOpen}
        onOpenChange={setIsReplaceConfirmOpen}
        title="Reemplazar datos existentes"
        description="Ya existe información cargada para este período. ¿Deseas reemplazarla? Esta acción eliminará los datos actuales y los sustituirá con el archivo nuevo."
        actionLabel="Sí, reemplazar"
        destructive
        onConfirm={handleReplaceConfirmed}
      />
    </div>
  )
}
