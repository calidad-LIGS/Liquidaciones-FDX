import { NavLink, Outlet } from 'react-router-dom'
import { BarChart2, Calendar, FileText, LogOut, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof Calendar
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/periodos', label: 'Períodos', icon: Calendar },
  { to: '/cargar', label: 'Cargar Archivos', icon: Upload },
  { to: '/resultados', label: 'Resultados', icon: BarChart2 },
  { to: '/factura', label: 'Factura', icon: FileText, adminOnly: true },
]

export default function AppShell() {
  const { user, isAdmin, signOut } = useAuth()

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-4 py-5">
          <p className="font-heading text-base font-semibold text-sidebar-foreground">
            Liquidaciones FedEx
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <div className="mb-3 space-y-1.5 px-3">
            <p className="truncate text-sm text-sidebar-foreground">{user?.email}</p>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                isAdmin ? 'bg-primary/15 text-primary' : 'bg-accent text-muted-foreground'
              )}
            >
              {isAdmin ? 'Admin' : 'Operativo'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
