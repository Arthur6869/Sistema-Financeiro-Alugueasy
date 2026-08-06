import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
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
  const [sessaoResolvida, setSessaoResolvida] = useState(false)
  // Guarda de qual usuário o perfil em memória pertence. Serve para saber se o
  // perfil já foi buscado sem precisar de um `setCarregando(true)` dentro do
  // efeito — que dispara render em cascata.
  const [perfilDe, setPerfilDe] = useState<string | null>(null)

  const carregando = !sessaoResolvida
    || (!!session?.user && perfilDe !== session.user.id)

  useEffect(() => {
    let ativo = true

    // Sessão já salva no aparelho (o usuário não precisa logar toda vez)
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      setSessaoResolvida(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      if (!ativo) return
      setSession(novaSessao)
      setSessaoResolvida(true)
      if (!novaSessao) { setPerfil(null); setPerfilDe(null) }
    })

    return () => { ativo = false; sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const uid = session?.user?.id
    if (!uid || perfilDe === uid) return

    let ativo = true

    supabase
      .from('profiles')
      .select('id, full_name, role, ativo')
      .eq('id', uid)
      .single()
      .then(({ data, error }) => {
        if (!ativo) return
        // FAIL-CLOSED: sem perfil legível, o usuário não recebe papel nenhum.
        // Nunca assumir um papel padrão aqui — foi exatamente um padrão
        // implícito de 'analista' que causou o incidente de julho.
        setPerfil(error || !data ? null : (data as Perfil))
        setPerfilDe(uid)
      })

    return () => { ativo = false }
  }, [session, perfilDe])

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

  // Estável entre renders: as telas usam `sair` dentro de efeitos, e uma
  // referência nova a cada render faria o efeito rodar em loop.
  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfil(null)
    setPerfilDe(null)
  }, [])

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
