import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuth } from '#/shared/hooks/useAuth'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  return isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />
}
