import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatePeriodo, useListPeriodos } from '@/hooks/usePeriodos'
import { toast } from '@/lib/toast'
import type { EstadoPeriodo } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const ESTADO_BADGE: Record<EstadoPeriodo, { label: string; variant: BadgeProps['variant'] }> = {
  borrador: { label: 'Borrador', variant: 'muted' },
  en_revision: { label: 'En revisión', variant: 'warning' },
  cerrado: { label: 'Cerrado', variant: 'success' },
}

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

const integerFormatter = new Intl.NumberFormat('es-MX')

function formatPeriodo(mes: number, anio: number) {
  return `${MESES[mes - 1]} ${anio}`
}

interface FormState {
  mes: number
  anio: number
}

function initialFormState(): FormState {
  const now = new Date()
  return {
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
  }
}

const UNIQUE_VIOLATION = '23505'

export default function PeriodosPage() {
  const navigate = useNavigate()
  const { data: periodos, isLoading } = useListPeriodos()
  const createPeriodo = useCreatePeriodo()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(initialFormState)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) setDialogError(null)
  }

  const openDialog = () => {
    setForm(initialFormState())
    setDialogError(null)
    setIsDialogOpen(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDialogError(null)

    createPeriodo.mutate(
      { mes: form.mes, anio: form.anio },
      {
        onSuccess: () => {
          toast.success('Período creado correctamente.')
          setIsDialogOpen(false)
        },
        onError: (error) => {
          if (error.code === UNIQUE_VIOLATION) {
            setDialogError(
              `Ya existe un período para ${MESES[form.mes - 1]} ${form.anio}. No se pueden crear períodos duplicados.`
            )
            return
          }
          toast.error(error.message || 'No se pudo crear el período.')
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Períodos de Liquidación</h1>
        <Button onClick={openDialog}>Nuevo Período</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Período</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Anticipo período anterior</th>
              <th className="px-4 py-3 font-medium">Descuento guías FIS</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-8 w-16" />
                  </td>
                </tr>
              ))}

            {!isLoading &&
              periodos?.map((periodo) => (
                <tr key={periodo.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">
                    {formatPeriodo(periodo.mes, periodo.anio)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ESTADO_BADGE[periodo.estado].variant}>
                      {ESTADO_BADGE[periodo.estado].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {currencyFormatter.format(periodo.anticipo_periodo_anterior)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {integerFormatter.format(periodo.descuento_guias_fis)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/cargar?periodo=${periodo.id}`)}
                    >
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!isLoading && periodos?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No hay períodos registrados. Crea el primero.
            </p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogHeader>
          <DialogTitle>Nuevo Período</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mes">Mes</Label>
              <select
                id="mes"
                value={form.mes}
                onChange={(event) => setForm((prev) => ({ ...prev, mes: Number(event.target.value) }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {MESES.map((nombre, index) => (
                  <option key={nombre} value={index + 1}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anio">Año</Label>
              <Input
                id="anio"
                type="number"
                required
                value={form.anio}
                onChange={(event) => setForm((prev) => ({ ...prev, anio: Number(event.target.value) }))}
              />
            </div>
          </div>

          {dialogError && (
            <p className="text-sm text-destructive" role="alert">
              {dialogError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createPeriodo.isPending}>
              {createPeriodo.isPending ? 'Creando…' : 'Crear Período'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
