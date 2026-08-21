import { Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import LoginPage from '@/components/auth/LoginPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import PeriodosPage from '@/pages/PeriodosPage'
import { Toaster } from '@/components/ui/toaster'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/" element={<Navigate to="/periodos" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/periodos" element={<PeriodosPage />} />
          <Route path="/cargar" element={<div>Cargar Archivos</div>} />

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/resultados" element={<div>Resultados</div>} />
            <Route path="/factura" element={<div>Factura</div>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/periodos" replace />} />
      </Routes>

      <Toaster />
    </QueryClientProvider>
  )
}

export default App
