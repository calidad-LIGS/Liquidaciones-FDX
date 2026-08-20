export type UserRole = 'admin' | 'operativo'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export type EstadoPeriodo = 'borrador' | 'en_revision' | 'cerrado'
