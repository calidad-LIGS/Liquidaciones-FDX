import { useState } from 'react'
import {
  useAddConcepto,
  useConceptosAdmin,
  useTramosAdmin,
  useUpdateConcepto,
  useUpdateTramo,
} from '@/hooks/useCatalogo'
import { toast } from '@/lib/toast'
import type { TipoCalculo } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const TIPO_CALCULO_LABELS: Record<TipoCalculo, string> = {
  conteo_filtro: 'Conteo filtrado',
  suma_resta: 'Suma y resta',
  tramo_excedente: 'Tramo excedente',
  conteo_hoja: 'Conteo de hoja',
  suma_columna: 'Suma de columna',
  manual_directo: 'Manual directo',
}

function formatRango(guiaMin: number, guiaMax: number | null): string {
  return guiaMax === null ? `${guiaMin} en adelante` : `${guiaMin} - ${guiaMax}`
}

interface ConceptoEdit {
  precio_unitario?: number
  activo?: boolean
}

export default function CatalogoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Catálogo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra los conceptos facturables y los tramos de precio de guías adicionales.
        </p>
      </div>

      <ConceptosSection />
      <TramosSection />
    </div>
  )
}

function ConceptosSection() {
  const { data: conceptos, isLoading } = useConceptosAdmin()
  const updateConcepto = useUpdateConcepto()
  const addConcepto = useAddConcepto()

  const [pendingEdits, setPendingEdits] = useState<Record<string, ConceptoEdit>>({})

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoDescripcion, setNuevoDescripcion] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState(0)
  const [nuevoActivo, setNuevoActivo] = useState(true)

  const resetAddForm = () => {
    setNuevoCodigo('')
    setNuevoDescripcion('')
    setNuevoPrecio(0)
    setNuevoActivo(true)
  }

  const handleOpenAddDialog = () => {
    resetAddForm()
    setIsAddDialogOpen(true)
  }

  const handleAgregarConcepto = async () => {
    const codigo = nuevoCodigo.trim().toUpperCase()
    const descripcion = nuevoDescripcion.trim()

    if (!codigo) {
      toast.error('El código es obligatorio.')
      return
    }
    if (!descripcion) {
      toast.error('La descripción es obligatoria.')
      return
    }
    const yaExiste = conceptos?.some((c) => c.codigo.toUpperCase() === codigo)
    if (yaExiste) {
      toast.error(`El código "${codigo}" ya está en uso.`)
      return
    }

    try {
      await addConcepto.mutateAsync({
        codigo,
        descripcion,
        precio_unitario: nuevoPrecio,
        activo: nuevoActivo,
      })
      toast.success('Concepto agregado')
      setIsAddDialogOpen(false)
      resetAddForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar el concepto.')
    }
  }

  const handlePrecioChange = (id: string, value: string) => {
    const parsed = Number(value)
    setPendingEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], precio_unitario: Number.isNaN(parsed) ? 0 : parsed },
    }))
  }

  const handleActivoChange = (id: string, checked: boolean) => {
    setPendingEdits((prev) => ({ ...prev, [id]: { ...prev[id], activo: checked } }))
  }

  const handleGuardar = async () => {
    const entries = Object.entries(pendingEdits)
    if (entries.length === 0) return

    try {
      for (const [id, changes] of entries) {
        await updateConcepto.mutateAsync({ id, ...changes })
      }
      setPendingEdits({})
      toast.success('Conceptos actualizados')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    }
  }

  const hasPendingEdits = Object.keys(pendingEdits).length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground">Conceptos facturables</h2>
        <Button onClick={handleOpenAddDialog}>Agregar concepto</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Tipo de cálculo</th>
              <th className="px-4 py-3 font-medium">Precio unitario</th>
              <th className="px-4 py-3 font-medium">Activo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-10" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-8" />
                  </td>
                </tr>
              ))}

            {!isLoading &&
              conceptos?.map((concepto) => {
                const edit = pendingEdits[concepto.id]
                const precio = edit?.precio_unitario ?? concepto.precio_unitario
                const activo = edit?.activo ?? concepto.activo

                return (
                  <tr key={concepto.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{concepto.codigo}</td>
                    <td className="px-4 py-3 text-foreground">{concepto.descripcion}</td>
                    <td className="px-4 py-3">
                      <Badge variant="muted">{TIPO_CALCULO_LABELS[concepto.tipo_calculo]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.0001"
                        value={precio}
                        onChange={(event) => handlePrecioChange(concepto.id, event.target.value)}
                        className="h-8 w-32 tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(event) => handleActivoChange(concepto.id, event.target.checked)}
                        className="h-4 w-4 rounded border-input accent-primary"
                        aria-label={`Activo — ${concepto.codigo}`}
                      />
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {hasPendingEdits && (
        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={updateConcepto.isPending}>
            {updateConcepto.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogHeader>
          <DialogTitle>Agregar concepto</DialogTitle>
          <DialogDescription>
            Los conceptos nuevos se capturan de forma manual desde Resultados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nuevo-codigo">Código</Label>
            <Input
              id="nuevo-codigo"
              value={nuevoCodigo}
              maxLength={10}
              onChange={(event) => setNuevoCodigo(event.target.value.toUpperCase())}
              placeholder="C36"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nuevo-descripcion">Descripción</Label>
            <Input
              id="nuevo-descripcion"
              value={nuevoDescripcion}
              onChange={(event) => setNuevoDescripcion(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nuevo-tipo-calculo">Tipo de cálculo</Label>
            <select
              id="nuevo-tipo-calculo"
              value="manual_directo"
              disabled
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="manual_directo">Manual directo</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Los conceptos nuevos siempre son de captura manual.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nuevo-precio">Precio unitario</Label>
            <Input
              id="nuevo-precio"
              type="number"
              step="0.0001"
              value={nuevoPrecio}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                setNuevoPrecio(Number.isNaN(parsed) ? 0 : parsed)
              }}
              className="tabular-nums"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="nuevo-activo"
              type="checkbox"
              checked={nuevoActivo}
              onChange={(event) => setNuevoActivo(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="nuevo-activo">Activo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleAgregarConcepto} disabled={addConcepto.isPending}>
            {addConcepto.isPending ? 'Agregando…' : 'Agregar'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function TramosSection() {
  const { data: tramos, isLoading } = useTramosAdmin()
  const updateTramo = useUpdateTramo()

  const [pendingEdits, setPendingEdits] = useState<Record<string, number>>({})

  const handlePrecioChange = (id: string, value: string) => {
    const parsed = Number(value)
    setPendingEdits((prev) => ({ ...prev, [id]: Number.isNaN(parsed) ? 0 : parsed }))
  }

  const handleGuardar = async () => {
    const entries = Object.entries(pendingEdits)
    if (entries.length === 0) return

    try {
      for (const [id, precio_unitario] of entries) {
        await updateTramo.mutateAsync({ id, precio_unitario })
      }
      setPendingEdits({})
      toast.success('Tramos actualizados')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    }
  }

  const hasPendingEdits = Object.keys(pendingEdits).length > 0

  return (
    <div className="space-y-3">
      <h2 className="font-heading text-base font-semibold text-foreground">
        Tramos de precio — Despacho de guías adicionales (C03)
      </h2>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Rango de guías</th>
              <th className="px-4 py-3 font-medium">Precio unitario</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                </tr>
              ))}

            {!isLoading && tramos?.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-muted-foreground">
                  No hay tramos de precio configurados.
                </td>
              </tr>
            )}

            {!isLoading &&
              tramos?.map((tramo) => {
                const precio = pendingEdits[tramo.id] ?? tramo.precio_unitario

                return (
                  <tr key={tramo.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {formatRango(tramo.guia_min, tramo.guia_max)}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.0001"
                        value={precio}
                        onChange={(event) => handlePrecioChange(tramo.id, event.target.value)}
                        className="h-8 w-32 tabular-nums"
                      />
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {hasPendingEdits && (
        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={updateTramo.isPending}>
            {updateTramo.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </div>
  )
}
