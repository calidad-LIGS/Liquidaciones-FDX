import { jsPDF } from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
import { currencyFormatter, currencyFormatter4 } from '@/lib/format'
import { MESES_ES } from '@/lib/meses'
import type { ConceptoFacturable, Periodo, ResultadoCalculo, TramoPrecio } from '@/types'

export interface FacturaLineItem {
  kind: 'header' | 'item'
  descripcion: string
  cantidad: number | null
  precioUnitario: number | null
  total: number | null
}

export interface FacturaTotals {
  subtotal: number
  iva: number
  total: number
  anticipo: number
  totalFactura: number
}

function lastDayOfMonth(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate()
}

async function loadImageAsBase64(url: string): Promise<string> {
  const img = new Image()
  img.src = url
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${url}`))
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

export function buildFacturaLineItems(
  conceptos: ConceptoFacturable[],
  resultados: ResultadoCalculo[],
  tramos: TramoPrecio[],
  options: { includeZeroRows: boolean }
): FacturaLineItem[] {
  const resultadoByConcepto = new Map(resultados.map((r) => [r.concepto_id, r]))
  const items: FacturaLineItem[] = []

  for (const concepto of conceptos) {
    const resultado = resultadoByConcepto.get(concepto.id)
    const cantidad = resultado?.cantidad ?? 0
    const precio = resultado?.precio_aplicado ?? concepto.precio_unitario

    if (concepto.codigo === 'C03') {
      items.push({ kind: 'header', descripcion: concepto.descripcion, cantidad: null, precioUnitario: null, total: null })

      if (cantidad > 0) {
        const tramo = tramos.find(
          (t) => t.guia_min <= cantidad && (t.guia_max === null || cantidad <= t.guia_max)
        )
        const tramoLabel = tramo
          ? `Tramo ${tramo.guia_min}–${tramo.guia_max ?? 'en adelante'} guías`
          : 'Guías excedentes'
        items.push({ kind: 'item', descripcion: tramoLabel, cantidad, precioUnitario: precio, total: cantidad * precio })
      }
      continue
    }

    if (cantidad > 0) {
      items.push({ kind: 'item', descripcion: concepto.descripcion, cantidad, precioUnitario: precio, total: cantidad * precio })
    } else if (options.includeZeroRows) {
      items.push({ kind: 'item', descripcion: concepto.descripcion, cantidad: 0, precioUnitario: precio, total: null })
    }
  }

  return items
}

export function calculateFacturaTotals(items: FacturaLineItem[], anticipo: number): FacturaTotals {
  const subtotal = items.reduce((sum, item) => sum + (item.total ?? 0), 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva
  return { subtotal, iva, total, anticipo, totalFactura: total - anticipo }
}

export async function generateFacturaPDF(
  periodo: Periodo,
  conceptos: ConceptoFacturable[],
  resultados: ResultadoCalculo[],
  tramos: TramoPrecio[]
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const margin = 15
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const mesLabel = MESES_ES[periodo.mes - 1].toUpperCase()
  const lastDay = lastDayOfMonth(periodo.mes, periodo.anio)

  const logoBase64 = await loadImageAsBase64('/logo-gap.png')
  doc.addImage(logoBase64, 'PNG', 15, 10, 50, 18)

  const titleY = 32
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('DESGLOSE DE FACTURAS FEDEX', pageWidth / 2, titleY, { align: 'center' })

  const subtitleBandY = titleY + 6
  doc.setFillColor(255, 215, 0)
  doc.rect(margin, subtitleBandY, pageWidth - margin * 2, 8, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(
    `TOTAL DE FACTURA DEL 01 AL ${lastDay} DE ${mesLabel} ${periodo.anio}`,
    pageWidth / 2,
    subtitleBandY + 5.5,
    { align: 'center' }
  )

  const items = buildFacturaLineItems(conceptos, resultados, tramos, { includeZeroRows: true })

  const body: RowInput[] = items.map((item): RowInput => {
    if (item.kind === 'header') {
      return [{ content: item.descripcion, colSpan: 4, styles: { fontStyle: 'bold' } }]
    }
    return [
      item.cantidad != null ? String(item.cantidad) : '-',
      item.descripcion,
      item.precioUnitario != null ? currencyFormatter4.format(item.precioUnitario) : '-',
      item.total != null ? currencyFormatter.format(item.total) : '-',
    ]
  })

  autoTable(doc, {
    startY: subtitleBandY + 14,
    margin: { left: margin, right: margin },
    head: [['CANTIDAD', 'DESCRIPCION', 'PRECIO UNITARIO', 'TOTAL']],
    body,
    columnStyles: {
      0: { cellWidth: 25, halign: 'right' },
      1: { cellWidth: 100, halign: 'left' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { fontSize: 8, cellPadding: 2 },
  })

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? subtitleBandY + 20

  const totals = calculateFacturaTotals(items, periodo.anticipo_periodo_anterior)
  const mesAnteriorIndex = periodo.mes === 1 ? 12 : periodo.mes - 1
  const anioAnterior = periodo.mes === 1 ? periodo.anio - 1 : periodo.anio
  const mesAnteriorLabel = MESES_ES[mesAnteriorIndex - 1].toUpperCase()

  const rightX = pageWidth - margin
  let y = finalY + 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const footerRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(`${label} ${value}`, rightX, y, { align: 'right' })
    y += 6
  }

  footerRow('SUBTOTAL:', currencyFormatter.format(totals.subtotal))
  footerRow('I.V.A.:', currencyFormatter.format(totals.iva))
  footerRow('TOTAL:', currencyFormatter.format(totals.total))
  footerRow(`ANTICIPO ${mesAnteriorLabel} ${anioAnterior}:`, currencyFormatter.format(totals.anticipo))
  footerRow(
    `TOTAL DE FACTURA DEL 01 AL ${lastDay} DE ${mesLabel} ${periodo.anio}:`,
    currencyFormatter.format(totals.totalFactura),
    true
  )

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Página ${i} de ${pageCount}`, rightX, pageHeight - 8, { align: 'right' })
  }

  return doc
}
