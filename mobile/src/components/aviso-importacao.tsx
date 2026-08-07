import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import { FONTES, MESES } from '@/constants/tema'

type LinhaImportacao = {
  id: string
  tipo: string | null
  mes: number | null
  ano: number | null
  nome_arquivo: string | null
  status: string | null
}

const ROTULO_TIPO: Record<string, string> = {
  custos_adm: 'Custos ADM',
  custos_sub: 'Custos SUB',
  diarias_adm: 'Diárias ADM',
  diarias_sub: 'Diárias SUB',
}

/**
 * Avisa quando uma planilha é importada no sistema web e recarrega a tela.
 *
 * Por que escutar `importacoes` e não `custos`/`diarias`: uma importação insere
 * centenas de linhas de uma vez nessas duas tabelas, o que viraria uma enxurrada
 * de eventos. Já `importacoes` recebe UMA linha por importação, com o status
 * final — um evento, no momento certo. Ver `supabase/migrations/038`.
 *
 * A RLS da tabela restringe a leitura a interno, e o Realtime a avalia antes de
 * entregar: proprietário não recebe estes eventos, o que é o correto.
 *
 * Enquanto a migration 038 não for aplicada, este componente simplesmente não
 * recebe nada — a tela continua funcionando pelo "puxar para atualizar" e pelo
 * rebusca-ao-focar. Não quebra nada.
 */
export function AvisoImportacao({ aoImportar }: { aoImportar: () => void }) {
  const [aviso, setAviso] = useState<LinhaImportacao | null>(null)
  const [tentativa, setTentativa] = useState(0)

  // A função de recarregar muda a cada render (depende de mês/ano); guardar em
  // ref evita recriar o canal e perder eventos.
  const aoImportarRef = useRef(aoImportar)
  useEffect(() => { aoImportarRef.current = aoImportar })

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const canal = supabase
      .channel(`importacoes-${tentativa}`)
      .on<LinhaImportacao>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'importacoes' },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const linha = payload.new

          // Importação com erro não muda número nenhum — não vale recarregar.
          if (String(linha.status ?? '').toLowerCase() !== 'concluido') return

          setAviso(linha)
          // Espera o banco terminar de gravar as linhas de custos/diárias antes
          // de rebuscar: o registro em `importacoes` é gravado ao final, mas a
          // leitura logo em seguida pode pegar o commit pela metade.
          clearTimeout(timer.current)
          timer.current = setTimeout(() => aoImportarRef.current(), 1200)
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase.removeChannel(canal)
          setTimeout(() => setTentativa(t => t + 1), 5000)
        }
      })

    return () => {
      supabase.removeChannel(canal)
      clearTimeout(timer.current)
    }
  }, [tentativa])

  if (!aviso) return null

  const tipo = ROTULO_TIPO[aviso.tipo ?? ''] ?? 'Planilha'
  const periodo = aviso.mes && aviso.ano ? `${MESES[aviso.mes - 1]} ${aviso.ano}` : ''

  return (
    <View style={e.caixa}>
      <View style={e.ponto} />
      <View style={{ flex: 1 }}>
        <Text style={e.titulo}>Importação concluída</Text>
        <Text style={e.detalhe}>
          {tipo}{periodo ? ` · ${periodo}` : ''} — os números foram atualizados.
        </Text>
      </View>
      <Pressable onPress={() => setAviso(null)} hitSlop={10}>
        <Text style={e.fechar}>×</Text>
      </Pressable>
    </View>
  )
}

const e = StyleSheet.create({
  caixa: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  titulo: { fontFamily: FONTES.semi, fontSize: 13, color: '#14532d' },
  detalhe: { fontFamily: FONTES.regular, fontSize: 11.5, color: '#166534', marginTop: 2 },
  fechar: { fontSize: 20, color: '#16a34a', lineHeight: 20 },
})
