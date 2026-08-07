import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAtualizarAoFocar } from '@/lib/usar-atualizacao'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES } from '@/constants/tema'
import { EquipeTopo } from '@/components/equipe-nav'
import { Painel, Vazio } from '@/components/painel'

type Proprietario = {
  id: string
  full_name: string | null
  ativo: boolean | null
  imoveis: number
}

export default function Usuarios() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const [lista, setLista] = useState<Proprietario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    // Só analista, como no site — o item nem aparece no "Mais" para admin.
    if (!carregandoAuth && (!ehEquipe(perfil) || perfil?.role !== 'analista')) {
      router.replace('/equipe/mais' as never)
    }
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const [perfisRes, vinculosRes] = await Promise.all([
        supabase.from('profiles')
          .select('id, full_name, ativo')
          .eq('role', 'proprietario')
          .order('full_name'),
        supabase.from('proprietario_apartamentos')
          .select('proprietario_id').eq('ativo', true),
      ])
      if (perfisRes.error) throw perfisRes.error

      const contagem = new Map<string, number>()
      for (const v of vinculosRes.data ?? []) {
        contagem.set(v.proprietario_id, (contagem.get(v.proprietario_id) ?? 0) + 1)
      }

      setLista((perfisRes.data ?? []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        ativo: p.ativo,
        imoveis: contagem.get(p.id) ?? 0,
      })))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os usuários.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [])

  useEffect(() => {
    if (perfil?.role === 'analista') { setCarregando(true); buscar() }
  }, [perfil, buscar])

  // Planilha importada no sistema web não dispara Realtime — só amenitiz_reservas
  // é publicada. Rebuscar ao voltar para a tela cobre esse caso.
  useAtualizarAoFocar(buscar, perfil?.role === 'analista')

  const ativos = lista.filter(p => p.ativo !== false).length

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Usuários" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <Text style={e.subtitulo}>
          {lista.length} conta{lista.length === 1 ? '' : 's'} de proprietário · {ativos} ativa{ativos === 1 ? '' : 's'}
        </Text>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <Painel titulo="Proprietários">
            {lista.length === 0 ? (
              <Vazio titulo="Nenhum proprietário" descricao="Nenhuma conta cadastrada ainda." />
            ) : lista.map(p => (
              <View key={p.id} style={e.item}>
                <View style={e.avatar}>
                  <Text style={e.avatarTexto}>
                    {(p.full_name ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={e.nome}>{p.full_name ?? 'Sem nome'}</Text>
                  <Text style={e.detalhe}>
                    {p.imoveis} imóvel{p.imoveis === 1 ? '' : 'is'} vinculado{p.imoveis === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={[e.selo, p.ativo === false ? e.seloInativo : e.seloAtivo]}>
                  <Text style={[e.seloTexto, { color: p.ativo === false ? '#b91c1c' : '#15803d' }]}>
                    {p.ativo === false ? 'Suspensa' : 'Ativa'}
                  </Text>
                </View>
              </View>
            ))}
          </Painel>
        )}

        <View style={e.aviso}>
          <Text style={e.avisoTitulo}>Criação de contas fica no sistema web</Text>
          <Text style={e.avisoTexto}>
            Criar conta, trocar senha e vincular imóveis exigem a chave de serviço,
            que por segurança nunca é embarcada no aplicativo. Aqui a lista é
            somente para consulta.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco, marginBottom: 16 },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: CORES.azul,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTexto: { fontFamily: FONTES.bold, fontSize: 15, color: CORES.branco },
  nome: { fontFamily: FONTES.semi, fontSize: 13.5, color: CORES.texto },
  detalhe: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 2 },

  selo: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  seloAtivo: { backgroundColor: '#dcfce7' },
  seloInativo: { backgroundColor: '#fee2e2' },
  seloTexto: { fontFamily: FONTES.bold, fontSize: 10 },

  aviso: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 14, padding: 16, marginTop: 4,
  },
  avisoTitulo: { fontFamily: FONTES.semi, fontSize: 13, color: '#92400e', marginBottom: 4 },
  avisoTexto: { fontFamily: FONTES.regular, fontSize: 12.5, color: '#92400e', lineHeight: 19 },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})
