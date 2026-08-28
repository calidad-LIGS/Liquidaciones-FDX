import * as XLSX from 'xlsx-js-style'
import type { CellStyle } from 'xlsx-js-style'

const HEADER_STYLE: CellStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'D3D3D3' }, patternType: 'solid' },
}

interface TemplateSheet {
  name: string
  headers: string[]
}

function buildTemplateSheet({ headers }: TemplateSheet): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([headers])

  headers.forEach((_, col) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: col })]
    if (cell) cell.s = HEADER_STYLE
  })

  ws['!cols'] = headers.map(() => ({ wch: 18 }))
  return ws
}

function buildTemplateWorkbook(sheets: TemplateSheet[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, buildTemplateSheet(sheet), sheet.name)
  }
  return wb
}

const TABLA_LIQ_FDX_SHEETS: TemplateSheet[] = [
  { name: 'Comercializadoras', headers: ['NO.', 'PAGO DE PEDIMENTO', 'PEDIMENTO', '# GUÍA'] },
  {
    name: 'Etiquetas',
    headers: [
      'REFRENCIA',
      'NUMERO PEDIMENTO',
      'TIPO',
      'CAPTURISTA',
      'CLAVE',
      'CLIENTE',
      'F ENTRADA',
      'F SALIDA',
      'ETIQUETAS',
      'CONS',
    ],
  },
  { name: 'Art. 40', headers: ['FECHA/PAGO', 'OPERACIÓN', 'SERVICIO', 'IMPORTE', 'FECHA DEL SERVICIO', 'CLIENTE'] },
  {
    name: 'Pasajeros',
    headers: [
      'DESTINO',
      'REASON CODE',
      'No DE GUIA',
      'FECHA DE ENTRADA',
      'CLIENTE',
      'DESCRIPCION DE LA MERCANCIA',
      'INFORMACION DE CONTACTO',
      'FECHA DE LIBERACION DE ADUANA',
      'EJECUTIVO CS A CARGO',
      'MES DE LIBERACION',
    ],
  },
  {
    name: 'Fis',
    headers: [
      'REFRENCIA',
      'NUMERO PEDIMENTO',
      'GUÍAS',
      'TIPO',
      'CAPTURISTA',
      'CLAVE',
      'CLIENTE',
      'F ENTRADA',
      'F SALIDA',
      'GUIAS2',
      'BULTOS',
      'T OP',
      'GUÍAS ¨FIS',
    ],
  },
  { name: 'DPA', headers: ['NO.', 'FECHA', 'PEDIMENTO', 'CONCEPTO', 'IMPORTE (MXN)', 'NOMBRE ORIGINAL'] },
  {
    name: 'Hallazgos',
    headers: ['Fecha de Llegada', 'NÚMERO DE GUÍA', 'NOMBRE DESTINATARIO', 'DESCRIPCIÓN DE MERCANCIAS'],
  },
  {
    name: 'Rectificaciones',
    headers: [
      'REFERENCIA',
      'CLAVE',
      'CAPTURISTA',
      'CLIENTES',
      'OPERACION',
      'ADUANA',
      'PATENTE',
      'IMPUESTO',
      'CARGO',
      'OBSERVACION',
      'AA',
      'TARIFA',
      'ENTRADA',
      'SALIDA',
      'COSTO',
    ],
  },
]

const REPORTE_SISTEMA_SHEET: TemplateSheet = {
  name: 'Reporte del Sistema',
  headers: [
    'REFRENCIA',
    'NUMERO PEDIMENTO',
    'TIPO',
    'CAPTURISTA',
    'CLAVE',
    'CLIENTE',
    'F Entrada',
    'F Salida',
    'COVES',
    'ETIQUETAS',
    'PARTIDAS',
    'GUIAS',
    'BULTOS',
    'T OP',
    'DPA',
    'Nº GUIAS URGENTE',
    'Nº GUIAS EXTRAORDINARIAS',
    'COSTO',
    'DIFERENCIAS',
    'ADICIONALES',
    'COVES AA',
    'GUIAS URGENTES',
    'GUIAS EXTRAORDINARIAS IND/CONS',
    'GUIAS EXTRAORDINARIAS GLOBALES',
    'IMPUESTOS',
    'TOTAL',
    'Servicio Extraordinario',
    'Servicio Extraordinario 7pm',
  ],
}

export function downloadTablaLiqFDXTemplate(): void {
  const wb = buildTemplateWorkbook(TABLA_LIQ_FDX_SHEETS)
  XLSX.writeFile(wb, 'Plantilla_TablaLiqFDX.xlsx')
}

export function downloadReporteSistemaTemplate(): void {
  const wb = buildTemplateWorkbook([REPORTE_SISTEMA_SHEET])
  XLSX.writeFile(wb, 'Plantilla_ReporteDelSistema.xlsx')
}
