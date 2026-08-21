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
  created_at: string
  updated_at: string
}
