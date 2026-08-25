import * as XLSX from 'xlsx'
import type { WorkBook } from 'xlsx'

export interface ComercializadorasRow {
  no: number
  pago_pedimento: string | null
  pedimento: string
  num_guia: string
}

export interface EtiquetasRow {
  referencia: string
  numero_pedimento: string
  tipo: string
  capturista: string
  clave: string
  cliente: string
  fecha_entrada: string | null
  fecha_salida: string | null
  etiquetas: number
  cons: string
}

export interface Art40Row {
  fecha_pago: string | null
  operacion: string
  servicio: string
  importe: number
  fecha_servicio: string | null
  cliente: string
}

export interface PasajerosRow {
  destino: string
  reason_code: string
  no_guia: string
  fecha_entrada: string | null
  cliente: string
  descripcion_mercancia: string
  informacion_contacto: string
  fecha_liberacion_aduana: string | null
  ejecutivo_cs: string
  mes_liberacion: string
}

export interface FisRow {
  referencia: string
  numero_pedimento: string
  guias: number | null
  tipo: string
  capturista: string
  clave: string
  cliente: string
  fecha_entrada: string | null
  fecha_salida: string | null
  guias2: number | null
  bultos: number | null
  t_op: string
  guias_fis: number | null
}

export interface DpaRow {
  no: number
  fecha: string | null
  pedimento: string
  concepto: string
  importe_mxn: number
  nombre_original: string
}

export interface HallazgosRow {
  fecha: string | null
  numero_guia: string
  nombre_destinatario: string
  descripcion_mercancias: string | null
}

export interface RectificacionesRow {
  referencia: string
  clave: string
  capturista: string
  cliente: string
  operacion: string
  aduana: number | null
  patente: number | null
  impuesto: number | null
  cargo: string
  observacion: string
  aa: string
  tarifa: number | null
  entrada: string | null
  salida: string | null
  costo: number | null
}

export interface ReporteRow {
  referencia: string
  numero_pedimento: string
  tipo: string
  capturista: string
  clave: string
  cliente: string
  fecha_entrada: string | null
  fecha_salida: string | null
  coves: number
  etiquetas: number
  partidas: number
  guias: number
  bultos: number
  t_op: string
  dpa: string
  num_guias_urgente: number
  num_guias_extraordinarias: number
  costo: number
  diferencias: number
  adicionales: number
  coves_aa: number
  guias_urgentes: number
  guias_extraordinarias_ind_cons: number
  guias_extraordinarias_globales: number
  impuestos: number
  total: number
  servicio_extraordinario: string
  servicio_extraordinario_7pm: string
}

export interface ParsedTablaLiqFDX {
  comercializadoras: ComercializadorasRow[]
  etiquetas: EtiquetasRow[]
  art40: Art40Row[]
  pasajeros: PasajerosRow[]
  fis: FisRow[]
  dpa: DpaRow[]
  hallazgos: HallazgosRow[]
  rectificaciones: RectificacionesRow[]
  totalGuiasFis: number
  totalEtiquetas: number
}

const MESES_ES_LOOKUP: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'number' && Number.isNaN(value)) return true
  if (typeof value === 'string' && value.trim() === '') return true
  return false
}

function toStringOrEmpty(value: unknown): string {
  if (isBlank(value)) return ''
  return String(value).trim()
}

function parseIntLoose(value: unknown): number | null {
  if (isBlank(value)) return null
  if (typeof value === 'number') return Math.trunc(value)
  const cleaned = String(value).replace(/\s+/g, '')
  if (cleaned === '') return null
  const parsed = Number.parseInt(cleaned, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function parseCurrency(value: unknown): number | null {
  if (isBlank(value)) return null
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  if (cleaned === '' || cleaned === '.') return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

function excelSerialToISODate(serial: number): string | null {
  const parsed = XLSX.SSF.parse_date_code(serial)
  if (!parsed) return null
  return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`
}

function parseDateValue(value: unknown): string | null {
  if (isBlank(value)) return null

  if (typeof value === 'number') {
    return excelSerialToISODate(value)
  }

  const trimmed = String(value).trim()

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const [, day, month, year] = slashMatch
    return `${year}-${pad(Number(month))}-${pad(Number(day))}`
  }

  const spanishMatch = trimmed.match(/^(\d{1,2})\s+de\s+([a-zñáéíóú]+)\s+de\s+(\d{4})/i)
  if (spanishMatch) {
    const [, day, monthName, year] = spanishMatch
    const month = MESES_ES_LOOKUP[monthName.toLowerCase()]
    if (month) return `${year}-${pad(month)}-${pad(Number(day))}`
  }

  const parsedDate = new Date(trimmed)
  if (!Number.isNaN(parsedDate.getTime())) {
    return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`
  }

  return null
}

function mapSheet<T>(
  workbook: WorkBook,
  sheetName: string,
  firstColumnName: string,
  mapRow: (get: (columnName: string) => unknown) => T
): T[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true })
  const [headerRow, ...dataRows] = raw
  const headers = (headerRow ?? []).map((h) => (typeof h === 'string' ? h.trim() : String(h ?? '')))

  const results: T[] = []
  for (const row of dataRows) {
    const get = (columnName: string): unknown => {
      const index = headers.indexOf(columnName)
      return index === -1 ? undefined : row[index]
    }
    if (isBlank(get(firstColumnName))) continue
    results.push(mapRow(get))
  }
  return results
}

function parseComercializadoras(workbook: WorkBook): ComercializadorasRow[] {
  return mapSheet(workbook, 'Comercializadoras', 'NO.', (get) => ({
    no: parseIntLoose(get('NO.')) ?? 0,
    pago_pedimento: parseDateValue(get('PAGO DE PEDIMENTO')),
    pedimento: toStringOrEmpty(get('PEDIMENTO')),
    num_guia: toStringOrEmpty(get('# GUÍA')),
  }))
}

function parseEtiquetas(workbook: WorkBook): EtiquetasRow[] {
  return mapSheet(workbook, 'Etiquetas', 'REFRENCIA', (get) => ({
    referencia: toStringOrEmpty(get('REFRENCIA')),
    numero_pedimento: toStringOrEmpty(get('NUMERO PEDIMENTO')),
    tipo: toStringOrEmpty(get('TIPO')),
    capturista: toStringOrEmpty(get('CAPTURISTA')),
    clave: toStringOrEmpty(get('CLAVE')),
    cliente: toStringOrEmpty(get('CLIENTE')),
    fecha_entrada: parseDateValue(get('F ENTRADA')),
    fecha_salida: parseDateValue(get('F SALIDA')),
    etiquetas: parseIntLoose(get('ETIQUETAS')) ?? 0,
    cons: toStringOrEmpty(get('CONS')),
  }))
}

function parseArt40(workbook: WorkBook): Art40Row[] {
  return mapSheet(workbook, 'Art. 40', 'FECHA/PAGO', (get) => ({
    fecha_pago: parseDateValue(get('FECHA/PAGO')),
    operacion: toStringOrEmpty(get('OPERACIÓN')),
    servicio: toStringOrEmpty(get('SERVICIO')),
    importe: parseCurrency(get('IMPORTE')) ?? 0,
    fecha_servicio: parseDateValue(get('FECHA DEL SERVICIO')),
    cliente: toStringOrEmpty(get('CLIENTE')),
  }))
}

function parsePasajeros(workbook: WorkBook): PasajerosRow[] {
  return mapSheet(workbook, 'Pasajeros', 'DESTINO', (get) => ({
    destino: toStringOrEmpty(get('DESTINO')),
    reason_code: toStringOrEmpty(get('REASON CODE')),
    no_guia: toStringOrEmpty(get('No DE GUIA')),
    fecha_entrada: parseDateValue(get('FECHA DE ENTRADA')),
    cliente: toStringOrEmpty(get('CLIENTE')),
    descripcion_mercancia: toStringOrEmpty(get('DESCRIPCION DE LA MERCANCIA')),
    informacion_contacto: toStringOrEmpty(get('INFORMACION DE CONTACTO')),
    fecha_liberacion_aduana: parseDateValue(get('FECHA DE LIBERACION DE ADUANA')),
    ejecutivo_cs: toStringOrEmpty(get('EJECUTIVO CS A CARGO')),
    mes_liberacion: toStringOrEmpty(get('MES DE LIBERACION')),
  }))
}

function parseFis(workbook: WorkBook): FisRow[] {
  return mapSheet(workbook, 'Fis', 'REFRENCIA', (get) => ({
    referencia: toStringOrEmpty(get('REFRENCIA')),
    numero_pedimento: toStringOrEmpty(get('NUMERO PEDIMENTO')),
    guias: parseIntLoose(get('GUÍAS')),
    tipo: toStringOrEmpty(get('TIPO')),
    capturista: toStringOrEmpty(get('CAPTURISTA')),
    clave: toStringOrEmpty(get('CLAVE')),
    cliente: toStringOrEmpty(get('CLIENTE')),
    fecha_entrada: parseDateValue(get('F ENTRADA')),
    fecha_salida: parseDateValue(get('F SALIDA')),
    guias2: parseIntLoose(get('GUIAS2')),
    bultos: parseIntLoose(get('BULTOS')),
    t_op: toStringOrEmpty(get('T OP')),
    guias_fis: parseIntLoose(get('GUÍAS ¨FIS')),
  }))
}

function parseDpa(workbook: WorkBook): DpaRow[] {
  return mapSheet(workbook, 'DPA', 'NO.', (get) => ({
    no: parseIntLoose(get('NO.')) ?? 0,
    fecha: parseDateValue(get('FECHA')),
    pedimento: toStringOrEmpty(get('PEDIMENTO')),
    concepto: toStringOrEmpty(get('CONCEPTO')),
    importe_mxn: parseCurrency(get('IMPORTE (MXN)')) ?? 0,
    nombre_original: toStringOrEmpty(get('NOMBRE ORIGINAL')),
  }))
}

function parseHallazgos(workbook: WorkBook): HallazgosRow[] {
  return mapSheet(workbook, 'Hallazgos', 'Fecha de Llegada', (get) => ({
    fecha: parseDateValue(get('Fecha de Llegada')),
    numero_guia: toStringOrEmpty(get('NÚMERO DE GUÍA')),
    nombre_destinatario: toStringOrEmpty(get('NOMBRE DESTINATARIO')),
    descripcion_mercancias: toStringOrEmpty(get('DESCRIPCIÓN DE MERCANCIAS')) || null,
  }))
}

function parseRectificaciones(workbook: WorkBook): RectificacionesRow[] {
  return mapSheet(workbook, 'Rectificaciones', 'REFRENCIA', (get) => ({
    referencia: toStringOrEmpty(get('REFRENCIA')),
    clave: toStringOrEmpty(get('CLAVE')),
    capturista: toStringOrEmpty(get('CAPTURISTA')),
    cliente: toStringOrEmpty(get('CLIENTES')),
    operacion: toStringOrEmpty(get('OPERACIÓN')),
    aduana: parseIntLoose(get('ADUANA')),
    patente: parseIntLoose(get('PATENTE')),
    impuesto: parseCurrency(get('IMPUESTO')),
    cargo: toStringOrEmpty(get('CARGO')),
    observacion: toStringOrEmpty(get('OBSERVACION')),
    aa: toStringOrEmpty(get('AA')),
    tarifa: parseCurrency(get('TARIFA')),
    entrada: parseDateValue(get('ENTRADA')),
    salida: parseDateValue(get('SALIDA')),
    costo: parseCurrency(get('COSTO')),
  }))
}

function parseReporteSheet(workbook: WorkBook): ReporteRow[] {
  return mapSheet(workbook, 'Reporte del Sistema', 'REFRENCIA', (get) => ({
    referencia: toStringOrEmpty(get('REFRENCIA')),
    numero_pedimento: toStringOrEmpty(get('NUMERO PEDIMENTO')),
    tipo: toStringOrEmpty(get('TIPO')),
    capturista: toStringOrEmpty(get('CAPTURISTA')),
    clave: toStringOrEmpty(get('CLAVE')),
    cliente: toStringOrEmpty(get('CLIENTE')),
    fecha_entrada: parseDateValue(get('F Entrada')),
    fecha_salida: parseDateValue(get('F Salida')),
    coves: parseIntLoose(get('COVES')) ?? 0,
    etiquetas: parseIntLoose(get('ETIQUETAS')) ?? 0,
    partidas: parseIntLoose(get('PARTIDAS')) ?? 0,
    guias: parseIntLoose(get('GUIAS')) ?? 0,
    bultos: parseIntLoose(get('BULTOS')) ?? 0,
    t_op: toStringOrEmpty(get('T OP')),
    dpa: toStringOrEmpty(get('DPA')),
    num_guias_urgente: parseIntLoose(get('Nº GUIAS URGENTE')) ?? 0,
    num_guias_extraordinarias: parseIntLoose(get('Nº GUIAS EXTRAORDINARIAS')) ?? 0,
    costo: parseCurrency(get('COSTO')) ?? 0,
    diferencias: parseCurrency(get('DIFERENCIAS')) ?? 0,
    adicionales: parseCurrency(get('ADICIONALES')) ?? 0,
    coves_aa: parseIntLoose(get('COVES AA')) ?? 0,
    guias_urgentes: parseIntLoose(get('GUIAS URGENTES')) ?? 0,
    guias_extraordinarias_ind_cons: parseIntLoose(get('GUIAS EXTRAORDINARIAS IND/CONS')) ?? 0,
    guias_extraordinarias_globales: parseIntLoose(get('GUIAS EXTRAORDINARIAS GLOBALES')) ?? 0,
    impuestos: parseCurrency(get('IMPUESTOS')) ?? 0,
    total: parseCurrency(get('TOTAL')) ?? 0,
    servicio_extraordinario: toStringOrEmpty(get('Servicio Extraordinario')),
    servicio_extraordinario_7pm: toStringOrEmpty(get('Servicio Extraordinario 7pm')),
  }))
}

export async function parseReporteDelSistema(file: File): Promise<ReporteRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  return parseReporteSheet(workbook)
}

export async function parseTablaLiqFDX(file: File): Promise<ParsedTablaLiqFDX> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const etiquetas = parseEtiquetas(workbook)
  const fis = parseFis(workbook)

  return {
    comercializadoras: parseComercializadoras(workbook),
    etiquetas,
    art40: parseArt40(workbook),
    pasajeros: parsePasajeros(workbook),
    fis,
    dpa: parseDpa(workbook),
    hallazgos: parseHallazgos(workbook),
    rectificaciones: parseRectificaciones(workbook),
    totalGuiasFis: fis.reduce((sum, row) => sum + (row.guias_fis ?? 0), 0),
    totalEtiquetas: etiquetas.reduce((sum, row) => sum + row.etiquetas, 0),
  }
}
