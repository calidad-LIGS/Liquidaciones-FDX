import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useListPeriodos } from '@/hooks/usePeriodos'
import { useUpdatePeriodoDatos } from '@/hooks/useResultados'
import {
  useFacturaData,
  useGuardarFactura,
  useMarcarCerrado,
  useReabrirPeriodo,
  type FacturaData,
} from '@/hooks/useFactura'
import { buildFacturaLineItems, calculateFacturaTotals, generateFacturaPDF } from '@/lib/pdfGenerator'
import { toast } from '@/lib/toast'
import { formatPeriodo, MESES_ES } from '@/lib/meses'
import { ESTADO_BADGE } from '@/lib/estado'
import { currencyFormatter, currencyFormatter4 } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog } from '@/components/ui/alert-dialog'

export default function FacturaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: periodos, isLoading: isLoadingPeriodos } = useListPeriodos()

  const periodoId = searchParams.get('periodo')

  const handleSelectPeriodo = (id: string) => {
    navigate(id ? `/factura?periodo=${id}` : '/factura')
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
        <p className="text-sm text-muted-foreground">Selecciona un período para preparar su factura.</p>
      )}

      {periodoId && <FacturaContent key={periodoId} periodoId={periodoId} />}
    </div>
  )
}

function FacturaContent({ periodoId }: { periodoId: string }) {
  const { data, isLoading, error } = useFacturaData(periodoId)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-96 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Error al cargar la factura.'}</p>
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">No se encontró el período solicitado.</p>
  }

  return <FacturaView data={data} />
}

function lastDayOfMonth(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate()
}

function FacturaView({ data }: { data: FacturaData }) {
  const { periodo, conceptos, resultados, tramos } = data
  const { isAdmin } = useAuth()
  const updatePeriodoDatos = useUpdatePeriodoDatos()
  const marcarCerrado = useMarcarCerrado(periodo.id)
  const reabrirPeriodo = useReabrirPeriodo(periodo.id)
  const guardarFactura = useGuardarFactura(periodo.id)

  const [anticipoInput, setAnticipoInput] = useState(periodo.anticipo_periodo_anterior ?? 0)
  const [isGenerarDialogOpen, setIsGenerarDialogOpen] = useState(false)
  const [isReabrirDialogOpen, setIsReabrirDialogOpen] = useState(false)

  const hasUnsavedAnticipo = anticipoInput !== (periodo.anticipo_periodo_anterior ?? 0)
  const isProcessingFactura = guardarFactura.isPending || marcarCerrado.isPending

  const previewItems = buildFacturaLineItems(conceptos, resultados, tramos, { includeZeroRows: false })
  const totals = calculateFacturaTotals(previewItems, periodo.anticipo_periodo_anterior ?? 0)
  const hasResultados = resultados.length > 0

  const mesLabel = MESES_ES[periodo.mes - 1].toUpperCase()
  const lastDay = lastDayOfMonth(periodo.mes, periodo.anio)
  const mesAnteriorIndex = periodo.mes === 1 ? 12 : periodo.mes - 1
  const anioAnterior = periodo.mes === 1 ? periodo.anio - 1 : periodo.anio
  const mesAnteriorLabel = MESES_ES[mesAnteriorIndex - 1].toUpperCase()

  const handleGuardarAnticipo = () => {
    updatePeriodoDatos.mutate(
      { id: periodo.id, anticipo_periodo_anterior: anticipoInput },
      {
        onSuccess: () => toast.success('Anticipo guardado'),
        onError: (err) => toast.error(err.message || 'No se pudo guardar el anticipo.'),
      }
    )
  }

  const handleConfirmGenerarYCerrar = async () => {
    try {
      const doc = await generateFacturaPDF(periodo, conceptos, resultados, tramos)
      const filename = `Factura_FedEx_${String(periodo.mes).padStart(2, '0')}_${periodo.anio}.pdf`
      doc.save(filename)

      await guardarFactura.mutateAsync({
        subtotal: totals.subtotal,
        iva: totals.iva,
        total: totals.total,
        anticipo_aplicado: totals.anticipo,
        total_a_pagar: totals.totalFactura,
      })

      await marcarCerrado.mutateAsync()

      toast.success('Factura generada y período cerrado')
      setIsGenerarDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar la factura.')
    }
  }

  const handleConfirmReabrir = async () => {
    try {
      await reabrirPeriodo.mutateAsync()
      toast.success('Período reabierto')
      setIsReabrirDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo reabrir el período.')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-center font-heading text-lg font-bold text-foreground">DESGLOSE DE FACTURAS FEDEX</h1>
          <p className="mt-1 text-center text-sm font-medium uppercase text-muted-foreground">
            Total de factura del 01 al {lastDay} de {mesLabel} {periodo.anio}
          </p>

          {!hasResultados ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Este período no tiene resultados calculados. Ve a Resultados para calcularlos.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Cantidad</th>
                    <th className="px-4 py-2 font-medium">Descripción</th>
                    <th className="px-4 py-2 font-medium">Precio unitario</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, index) =>
                    item.kind === 'header' ? (
                      <tr key={index} className="border-b border-border bg-surface">
                        <td colSpan={4} className="px-4 py-2 font-semibold text-foreground">
                          {item.descripcion}
                        </td>
                      </tr>
                    ) : (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 tabular-nums text-foreground">{item.cantidad}</td>
                        <td className="px-4 py-2 text-foreground">{item.descripcion}</td>
                        <td className="px-4 py-2 tabular-nums text-foreground">
                          {item.precioUnitario != null ? currencyFormatter4.format(item.precioUnitario) : '-'}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-foreground">
                          {item.total != null ? currencyFormatter.format(item.total) : '-'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex flex-col items-end gap-1 text-sm">
            <div className="flex w-64 justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums text-foreground">{currencyFormatter.format(totals.subtotal)}</span>
            </div>
            <div className="flex w-64 justify-between">
              <span className="text-muted-foreground">I.V.A.</span>
              <span className="tabular-nums text-foreground">{currencyFormatter.format(totals.iva)}</span>
            </div>
            <div className="flex w-64 justify-between font-medium">
              <span className="text-muted-foreground">Total</span>
              <span className="tabular-nums text-foreground">{currencyFormatter.format(totals.total)}</span>
            </div>
            <div className="flex w-64 justify-between">
              <span className="text-muted-foreground">
                Anticipo {mesAnteriorLabel} {anioAnterior}
              </span>
              <span className="tabular-nums text-foreground">{currencyFormatter.format(totals.anticipo)}</span>
            </div>
            <div className="mt-1 flex w-64 justify-between border-t border-border pt-1 font-semibold">
              <span className="text-foreground">
                Total factura 01–{lastDay} {mesLabel} {periodo.anio}
              </span>
              <span className="tabular-nums text-foreground">{currencyFormatter.format(totals.totalFactura)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Resumen</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Período</dt>
              <dd className="font-medium text-foreground">{formatPeriodo(periodo.mes, periodo.anio)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <Badge variant={ESTADO_BADGE[periodo.estado].variant}>{ESTADO_BADGE[periodo.estado].label}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-foreground">{currencyFormatter.format(totals.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">IVA</dt>
              <dd className="tabular-nums text-foreground">{currencyFormatter.format(totals.iva)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="tabular-nums text-foreground">{currencyFormatter.format(totals.total)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Anticipo</dt>
              <dd className="tabular-nums text-foreground">{currencyFormatter.format(totals.anticipo)}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total a pagar</span>
              <span className="text-xl font-bold tabular-nums text-primary">
                {currencyFormatter.format(totals.totalFactura)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <Label htmlFor="anticipo-anterior">Anticipo período anterior</Label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="anticipo-anterior"
              type="number"
              step="0.01"
              value={anticipoInput}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                setAnticipoInput(Number.isNaN(parsed) ? 0 : parsed)
              }}
              className="pl-7 tabular-nums"
            />
          </div>

          {hasUnsavedAnticipo && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Registra el anticipo antes de generar la factura.
            </p>
          )}

          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGuardarAnticipo}
              disabled={updatePeriodoDatos.isPending || !hasUnsavedAnticipo}
            >
              {updatePeriodoDatos.isPending ? 'Guardando…' : 'Guardar anticipo'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={() => setIsGenerarDialogOpen(true)}
            disabled={!hasResultados || hasUnsavedAnticipo || periodo.estado === 'cerrado' || isProcessingFactura}
          >
            {isProcessingFactura && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {periodo.estado === 'cerrado' ? 'Período cerrado' : 'Generar PDF'}
          </Button>

          {periodo.estado === 'cerrado' && isAdmin && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsReabrirDialogOpen(true)}
              disabled={reabrirPeriodo.isPending}
            >
              {reabrirPeriodo.isPending ? 'Reabriendo…' : 'Reabrir período'}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={isGenerarDialogOpen}
        onOpenChange={setIsGenerarDialogOpen}
        title="¿Generar y cerrar factura?"
        description="Esta acción generará el PDF y marcará el período como cerrado. Una vez cerrado, solo administradores podrán reabrirlo."
        actionLabel={isProcessingFactura ? 'Generando…' : 'Generar y cerrar'}
        onConfirm={handleConfirmGenerarYCerrar}
      />

      <AlertDialog
        open={isReabrirDialogOpen}
        onOpenChange={setIsReabrirDialogOpen}
        title="Reabrir período"
        description="¿Reabrir este período? Esto permitirá modificar cantidades y regenerar la factura."
        actionLabel={reabrirPeriodo.isPending ? 'Reabriendo…' : 'Reabrir período'}
        onConfirm={handleConfirmReabrir}
        destructive
      />
    </div>
  )
}
