export type UserRole = 'admin' | 'operativo'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export type EstadoPeriodo = 'borrador' | 'en_revision' | 'cerrado'

export interface Periodo {
  id: string
  mes: number
  anio: number
  estado: EstadoPeriodo
  anticipo_periodo_anterior: number
  descuento_guias_fis: number
  notas: string | null
  ultima_carga_at: string | null
  ultima_carga_by: string | null
  created_at: string
  updated_at: string
}

export type TipoCalculo =
  | 'conteo_filtro'
  | 'suma_resta'
  | 'tramo_excedente'
  | 'conteo_hoja'
  | 'suma_columna'
  | 'manual_directo'

export interface ConceptoFacturable {
  id: string
  orden: number
  codigo: string
  descripcion: string
  tipo_calculo: TipoCalculo
  precio_unitario: number
}

export interface ResultadoCalculo {
  id: string
  periodo_id: string
  concepto_id: string
  cantidad: number
  precio_aplicado: number
  override_admin: boolean
  updated_by: string | null
  calculado_at: string | null
  updated_at: string
}

export interface TramoPrecio {
  id: string
  concepto_id: string
  guia_min: number
  guia_max: number | null
  precio_unitario: number
}
