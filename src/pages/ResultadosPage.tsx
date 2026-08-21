import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  ClipboardList,
  FileEdit,
  FileText,
  PackageCheck,
  Search,
  Tag,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useListPeriodos } from '@/hooks/usePeriodos'
import {
  useConceptos,
  useHojaData,
  useResultadosPeriodo,
  useResumenCarga,
  useUpsertResultado,
  type ResumenCarga,
  type SheetTableKey,
} from '@/hooks/useResultados'
import { toast } from '@/lib/toast'
import { formatPeriodo } from '@/lib/meses'
import { ESTADO_BADGE } from '@/lib/estado'
import { currencyFormatter, currencyFormatter4, formatDateShort, formatDateTime, integerFormatter } from '@/lib/format'
import type { AuthUser, Periodo, ResultadoCalculo } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export default function ResultadosPage() {
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: periodos, isLoading: isLoadingPeriodos } = useListPeriodos()

  const periodoId = searchParams.get('periodo')
  const periodo = periodos?.find((p) => p.id === periodoId) ?? null

  const handleSelectPeriodo = (id: string) => {
    navigate(id ? `/resultados?periodo=${id}` : '/resultados')
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xs space-y-2">
        <Label htmlFor="periodo-select">Período</Label>
        <select
          id="periodo-select"
          value={periodoId ?? ''}
          onChange={(event) => handleSelectPeriodo(event.target.value)}
          disabled={isLoadingPeriodos}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Selecciona un período</option>
          {periodos?.map((p) => (
            <option key={p.id} value={p.id}>
              {formatPeriodo(p.mes, p.anio)}
            </option>
          ))}
        </select>
      </div>

      {!periodoId && (
        <p className="text-sm text-muted-foreground">Selecciona un período para ver sus resultados.</p>
      )}

      {periodoId && isLoadingPeriodos && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {periodoId && !isLoadingPeriodos && !periodo && (
        <p className="text-sm text-muted-foreground">No se encontró el período solicitado.</p>
      )}

      {periodo &&
        (isAdmin ? <AdminView periodo={periodo} user={user} /> : <OperativoView periodo={periodo} user={user} />)}
    </div>
  )
}

interface ViewProps {
  periodo: Periodo
  user: AuthUser | null
}

function AdminView({ periodo, user }: ViewProps) {
  const { data: conceptos, isLoading: isLoadingConceptos } = useConceptos()
  const { data: resultados } = useResultadosPeriodo(periodo.id)
  const upsertResultado = useUpsertResultado()

  const [pendingEdits, setPendingEdits] = useState<Record<string, number>>({})

  const resultadosByConcepto = useMemo(() => {
    const map = new Map<string, ResultadoCalculo>()
    resultados?.forEach((r) => map.set(r.concepto_id, r))
    return map
  }, [resultados])

  const totals = useMemo(() => {
    const subtotal = (conceptos ?? []).reduce((sum, concepto) => {
      const resultado = resultadosByConcepto.get(concepto.id)
      const cantidad = pendingEdits[concepto.id] ?? resultado?.cantidad ?? 0
      const precio = resultado?.precio_aplicado ?? concepto.precio_unitario
      return sum + cantidad * precio
    }, 0)
    const iva = subtotal * 0.16
    return { subtotal, iva, total: subtotal + iva }
  }, [conceptos, resultadosByConcepto, pendingEdits])

  const handleCantidadChange = (conceptoId: string, value: string) => {
    const parsed = Math.trunc(Number(value))
    setPendingEdits((prev) => ({ ...prev, [conceptoId]: Number.isNaN(parsed) ? 0 : parsed }))
  }

  const handleSaveChanges = async () => {
    const entries = Object.entries(pendingEdits)
    if (entries.length === 0) return

    try {
      for (const [conceptoId, cantidad] of entries) {
        const concepto = conceptos?.find((c) => c.id === conceptoId)
        if (!concepto) continue
        await upsertResultado.mutateAsync({
          periodo_id: periodo.id,
          concepto_id: conceptoId,
          cantidad,
          precio_aplicado: concepto.precio_unitario,
          override_admin: true,
          updated_by: user?.id ?? null,
        })
      }
      setPendingEdits({})
      toast.success('Cambios guardados')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    }
  }

  const hasPendingEdits = Object.keys(pendingEdits).length > 0

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{formatPeriodo(periodo.mes, periodo.anio)}</h1>
        <Badge variant={ESTADO_BADGE[periodo.estado].variant}>{ESTADO_BADGE[periodo.estado].label}</Badge>
      </div>

      <div
        className="overflow-y-auto rounded-xl border border-border bg-card"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Precio unitario</th>
              <th className="px-4 py-3 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingConceptos &&
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-8" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                </tr>
              ))}

            {!isLoadingConceptos &&
              conceptos?.map((concepto) => {
                const resultado = resultadosByConcepto.get(concepto.id)
                const savedCantidad = resultado?.cantidad ?? 0
                const cantidad = pendingEdits[concepto.id] ?? savedCantidad
                const precio = resultado?.precio_aplicado ?? concepto.precio_unitario
                const subtotal = cantidad * precio

                return (
                  <tr key={concepto.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{concepto.orden}</td>
                    <td className="px-4 py-3 text-foreground">{concepto.descripcion}</td>
                    <td className="px-4 py-3">
                      {concepto.tipo_calculo === 'manual_directo' ? (
                        <Input
                          type="number"
                          step="1"
                          value={cantidad}
                          onChange={(event) => handleCantidadChange(concepto.id, event.target.value)}
                          className="h-8 w-24 tabular-nums"
                        />
                      ) : (
                        <span className="tabular-nums text-foreground">{cantidad}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{currencyFormatter4.format(precio)}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {resultado ? (
                        currencyFormatter.format(subtotal)
                      ) : (
                        <span className="flex items-center gap-2">
                          {currencyFormatter.format(0)}
                          <span className="text-xs text-muted-foreground">Sin calcular</span>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {hasPendingEdits && (
        <div className="flex justify-end">
          <Button onClick={handleSaveChanges} disabled={upsertResultado.isPending}>
            {upsertResultado.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card px-4 py-4">
        <div className="flex flex-wrap items-center justify-end gap-8">
          <div className="text-sm">
            <span className="text-muted-foreground">Subtotal: </span>
            <span className="tabular-nums font-medium text-foreground">
              {currencyFormatter.format(totals.subtotal)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">IVA (16%): </span>
            <span className="tabular-nums font-medium text-foreground">{currencyFormatter.format(totals.iva)}</span>
          </div>
          <div className="text-base">
            <span className="text-muted-foreground">Total: </span>
            <span className="tabular-nums font-semibold text-foreground">
              {currencyFormatter.format(totals.total)}
            </span>
          </div>
          <Button variant="outline" disabled title="Próximamente">
            Calcular
          </Button>
        </div>
      </div>
    </div>
  )
}

const RESUMEN_CARDS: { key: keyof ResumenCarga; label: string; unit: string; icon: typeof Building2 }[] = [
  { key: 'comercializadoras', label: 'Comercializadoras', unit: 'filas', icon: Building2 },
  { key: 'etiquetas', label: 'Etiquetas', unit: 'etiquetas', icon: Tag },
  { key: 'art40', label: 'Art. 40', unit: 'filas', icon: FileText },
  { key: 'pasajeros', label: 'Pasajeros', unit: 'filas', icon: Users },
  { key: 'fis', label: 'FIS', unit: 'guías FIS', icon: PackageCheck },
  { key: 'dpa', label: 'DPA', unit: 'filas', icon: ClipboardList },
  { key: 'hallazgos', label: 'Hallazgos', unit: 'filas', icon: Search },
  { key: 'rectificaciones', label: 'Rectificaciones', unit: 'filas', icon: FileEdit },
]

function OperativoView({ periodo, user }: ViewProps) {
  const { data: resumen, isLoading: isLoadingResumen } = useResumenCarga(periodo.id)

  const uploaderLabel = periodo.ultima_carga_by
    ? periodo.ultima_carga_by === user?.id
      ? (user?.email ?? periodo.ultima_carga_by)
      : periodo.ultima_carga_by
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{formatPeriodo(periodo.mes, periodo.anio)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {periodo.ultima_carga_at
            ? `Última carga: ${formatDateTime(periodo.ultima_carga_at)} por ${uploaderLabel}`
            : 'Aún no se ha cargado un archivo para este período.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {RESUMEN_CARDS.map(({ key, label, unit, icon: Icon }) => (
          <div key={key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-sm">{label}</span>
            </div>
            {isLoadingResumen ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-2 tabular-nums text-2xl font-semibold text-foreground">
                {integerFormatter.format(resumen?.[key] ?? 0)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{unit}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {RESUMEN_CARDS.map(({ key, label }) => (
          <SheetDetailSection
            key={key}
            sheetKey={key}
            label={label}
            periodoId={periodo.id}
            ultimaCargaAt={periodo.ultima_carga_at}
          />
        ))}
      </div>
    </div>
  )
}

function SheetDetailSection({
  sheetKey,
  label,
  periodoId,
  ultimaCargaAt,
}: {
  sheetKey: SheetTableKey
  label: string
  periodoId: string
  ultimaCargaAt: string | null
}) {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useHojaData(sheetKey, periodoId, open)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground">
        <span>
          {label}
          {ultimaCargaAt && (
            <span className="ml-2 font-normal text-muted-foreground">
              — cargado el {formatDateShort(ultimaCargaAt)}
            </span>
          )}
        </span>
        <span className="shrink-0 text-primary">{open ? 'Ocultar detalle' : 'Ver detalle →'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border p-4">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && data && <GenericDataTable rows={data} />}
      </CollapsibleContent>
    </Collapsible>
  )
}

const HIDDEN_COLUMNS = new Set(['id', 'periodo_id', 'created_at'])

function GenericDataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay datos para esta hoja.</p>
  }

  const columns = Object.keys(rows[0]).filter((key) => !HIDDEN_COLUMNS.has(key))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-0">
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-3 py-2 text-foreground">
                  {row[col] === null || row[col] === undefined ? '—' : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
