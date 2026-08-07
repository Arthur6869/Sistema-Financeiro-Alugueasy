import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'

/**
 * Rebusca os dados quando a tela volta a ficar visível.
 *
 * Por que isso é necessário: o Realtime do Supabase publica apenas
 * `amenitiz_reservas` (migration 035, PARTE 6 — publicar tabela que ninguém
 * escuta só amplia a superfície de exposição). Ou seja, reserva nova da Amenitiz
 * chega sozinha, mas custos e diárias importados por planilha no sistema web
 * NÃO disparam evento nenhum.
 *
 * Sem este gancho, o app só buscaria os dados na primeira montagem da tela: você
 * importaria a planilha no computador e o celular continuaria mostrando os
 * números velhos até fechar e abrir de novo.
 *
 * Dois momentos são cobertos:
 *   • trocar de aba e voltar   -> useFocusEffect
 *   • sair do app e voltar     -> AppState 'active'
 *
 * A primeira montagem é ignorada de propósito: a tela já busca sozinha nesse
 * momento, e repetir seria uma requisição duplicada em toda abertura.
 */
export function useAtualizarAoFocar(buscar: () => void, habilitado = true) {
  const primeiroFoco = useRef(true)

  // A função de busca é recriada a cada render (depende de mes/ano). Guardar em
  // ref mantém o callback do foco estável — sem isso o useFocusEffect
  // reexecutaria sem parar e viraria um laço de requisições.
  const buscarRef = useRef(buscar)
  useEffect(() => { buscarRef.current = buscar })

  useFocusEffect(
    useCallback(() => {
      if (primeiroFoco.current) { primeiroFoco.current = false; return }
      if (habilitado) buscarRef.current()
    }, [habilitado]),
  )

  useEffect(() => {
    if (!habilitado) return
    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') buscarRef.current()
    })
    return () => sub.remove()
  }, [habilitado])
}
