import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '@/components/auth/LoginPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'

function App() {
  return (
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
        <Route path="/periodos" element={<div>Períodos</div>} />
        <Route path="/cargar" element={<div>Cargar Archivos</div>} />

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/resultados" element={<div>Resultados</div>} />
          <Route path="/factura" element={<div>Factura</div>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/periodos" replace />} />
    </Routes>
  )
}

export default App
