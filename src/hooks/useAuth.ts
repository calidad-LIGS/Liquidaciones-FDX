import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AuthUser, UserRole } from '@/types'

function mapSession(session: Session | null): AuthUser | null {
  if (!session?.user) return null
  const role = (session.user.app_metadata?.role as UserRole | undefined) ?? 'operativo'
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    role,
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(mapSession(session))
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(mapSession(session))
      setIsLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return {
    user,
    role: user?.role ?? null,
    isAdmin: user?.role === 'admin',
    isLoading,
    signIn,
    signOut,
  }
}
