import * as XLSX from 'xlsx-js-style'
import type { CellStyle } from 'xlsx-js-style'
import { MESES_ES } from '@/lib/meses'
import type { Periodo } from '@/types'
import type { FacturaLineItem, FacturaTotals } from '@/lib/pdfGenerator'

const BOLD_STYLE: CellStyle = { font: { bold: true } }
const RIGHT_ALIGN_STYLE: CellStyle = { alignment: { horizontal: 'right' } }
const INTEGER_FORMAT = '#,##0'
const CURRENCY_4_FORMAT = '"$"#,##0.0000'
const CURRENCY_2_FORMAT = '"$"#,##0.00'

type RowKind = 'title' | 'subtitle' | 'blank' | 'tableHeader' | 'groupHeader' | 'item' | 'summary' | 'summaryBold'

function lastDayOfMonth(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate()
}

export async function generateFacturaExcel(
  periodo: Periodo,
  lineItems: FacturaLineItem[],
  totals: FacturaTotals
): Promise<void> {
  const mesLabel = MESES_ES[periodo.mes - 1].toUpperCase()
  const lastDay = lastDayOfMonth(periodo.mes, periodo.anio)
  const mesAnteriorIndex = periodo.mes === 1 ? 12 : periodo.mes - 1
  const anioAnterior = periodo.mes === 1 ? periodo.anio - 1 : periodo.anio
  const mesAnteriorLabel = MESES_ES[mesAnteriorIndex - 1].toUpperCase()

  const rows: (string | number | null)[][] = []
  const rowKinds: RowKind[] = []
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  function pushRow(row: (string | number | null)[], kind: RowKind): number {
    rows.push(row)
    rowKinds.push(kind)
    return rows.length - 1
  }

  let rowIndex = pushRow(['DESGLOSE DE FACTURAS FEDEX', null, null, null], 'title')
  merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 3 } })

  rowIndex = pushRow(
    [`TOTAL DE FACTURA DEL 01 AL ${lastDay} DE ${mesLabel} ${periodo.anio}`, null, null, null],
    'subtitle'
  )
  merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 3 } })

  pushRow([], 'blank')
  pushRow(['CANTIDAD', 'DESCRIPCION', 'PRECIO UNITARIO', 'TOTAL'], 'tableHeader')

  for (const item of lineItems) {
    if (item.kind === 'header') {
      rowIndex = pushRow([item.descripcion, null, null, null], 'groupHeader')
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 3 } })
    } else {
      pushRow(
        [item.cantidad, item.descripcion, item.precioUnitario, item.total != null ? item.total : '-'],
        'item'
      )
    }
  }

  pushRow([], 'blank')
  pushRow([null, null, 'SUBTOTAL', totals.subtotal], 'summary')
  pushRow([null, null, 'I.V.A.', totals.iva], 'summary')
  pushRow([null, null, 'TOTAL', totals.total], 'summary')
  pushRow([null, null, `ANTICIPO ${mesAnteriorLabel} ${anioAnterior}`, totals.anticipo], 'summary')
  pushRow(
    [null, null, `TOTAL DE FACTURA DEL 01 AL ${lastDay} DE ${mesLabel} ${periodo.anio}`, totals.totalFactura],
    'summaryBold'
  )

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 18 }, { wch: 18 }]

  function setCell(row: number, col: number, patch: { s?: CellStyle; z?: string }) {
    const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
    if (!cell) return
    if (patch.s) cell.s = patch.s
    if (patch.z) cell.z = patch.z
  }

  rowKinds.forEach((kind, r) => {
    switch (kind) {
      case 'title':
      case 'subtitle':
        setCell(r, 0, { s: BOLD_STYLE })
        break
      case 'item':
        setCell(r, 0, { s: RIGHT_ALIGN_STYLE, z: INTEGER_FORMAT })
        setCell(r, 2, { z: CURRENCY_4_FORMAT })
        if (typeof rows[r][3] === 'number') setCell(r, 3, { z: CURRENCY_2_FORMAT })
        break
      case 'summary':
        setCell(r, 3, { z: CURRENCY_2_FORMAT })
        break
      case 'summaryBold':
        setCell(r, 2, { s: BOLD_STYLE })
        setCell(r, 3, { s: BOLD_STYLE, z: CURRENCY_2_FORMAT })
        break
      default:
        break
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Desglose Factura')

  const filename = `Prefactura_FedEx_${String(periodo.mes).padStart(2, '0')}_${periodo.anio}.xlsx`
  XLSX.writeFile(wb, filename)
}
