import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Papéis do sistema. Precisam bater exatamente com o CHECK da coluna
 * `profiles.role` no banco — qualquer outro valor não recebe acesso a nada.
 *
 *   analista     -> equipe, faz CRUD
 *   admin        -> equipe, somente leitura
 *   proprietario -> cliente, vê apenas os imóveis dele
 *   pendente     -> conta recém-criada, sem nenhum acesso
 */
export type Papel = 'admin' | 'analista' | 'proprietario' | 'pendente'

export type Perfil = {
  id: string
  full_name: string | null
  role: Papel
  ativo: boolean
}

type AuthContexto = {
  session: Session | null
  perfil: Perfil | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<{ erro: string | null }>
  sair: () => Promise<void>
}

const Ctx = createContext<AuthContexto | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    // Sessão já salva no aparelho (o usuário não precisa logar toda vez)
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      if (!data.session) setCarregando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      if (!ativo) return
      setSession(novaSessao)
      if (!novaSessao) {
        setPerfil(null)
        setCarregando(false)
      }
    })

    return () => { ativo = false; sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session?.user) return

    let ativo = true
    setCarregando(true)

    supabase
      .from('profiles')
      .select('id, full_name, role, ativo')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return
        // FAIL-CLOSED: sem perfil legível, o usuário não recebe papel nenhum.
        // Nunca assumir um papel padrão aqui — foi exatamente um padrão
        // implícito de 'analista' que causou o incidente de julho.
        setPerfil(error || !data ? null : (data as Perfil))
        setCarregando(false)
      })

    return () => { ativo = false }
  }, [session])

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    })
    if (!error) return { erro: null }

    // Mensagem genérica de propósito: dizer "e-mail não existe" permite
    // descobrir quais contas existem no sistema.
    const generico = /invalid login credentials/i.test(error.message)
      ? 'E-mail ou senha incorretos.'
      : error.message
    return { erro: generico }
  }

  async function sair() {
    await supabase.auth.signOut()
    setPerfil(null)
  }

  return (
    <Ctx.Provider value={{ session, perfil, carregando, entrar, sair }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}

/** Equipe interna: acessa a área de gestão. */
export function ehEquipe(perfil: Perfil | null): boolean {
  return perfil?.role === 'analista' || perfil?.role === 'admin'
}

/** Proprietário com conta liberada. Conta suspensa não entra. */
export function ehProprietarioAtivo(perfil: Perfil | null): boolean {
  return perfil?.role === 'proprietario' && perfil.ativo !== false
}
