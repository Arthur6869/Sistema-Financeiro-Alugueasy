import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES } from '@/constants/tema'
import { EquipeTopo } from '@/components/equipe-nav'
import { Painel, Vazio } from '@/components/painel'

type Apt = {
  id: string
  numero: string
  tipo_gestao: string | null
  taxa_repasse: number | null
  tipo_repasse: string | null
  nome_proprietario: string | null
}
type Emp = { id: string; nome: string; apartamentos: Apt[] }

export default function Empreendimentos() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const [emps, setEmps] = useState<Emp[]>([])
  const [aberto, setAberto] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const [empRes, aptRes] = await Promise.all([
        supabase.from('empreendimentos').select('id, nome').order('nome'),
        supabase.from('apartamentos')
          .select('id, numero, empreendimento_id, tipo_gestao, taxa_repasse, tipo_repasse, nome_proprietario')
          .order('numero'),
      ])
      if (empRes.error) throw empRes.error
      if (aptRes.error) throw aptRes.error

      type AptBruto = Apt & { empreendimento_id: string }
      const apts = (aptRes.data ?? []) as unknown as AptBruto[]

      setEmps((empRes.data ?? []).map(e => ({
        id: e.id,
        nome: e.nome,
        apartamentos: apts.filter(a => a.empreendimento_id === e.id),
      })))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os empreendimentos.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [])

  useEffect(() => {
    if (ehEquipe(perfil)) { setCarregando(true); buscar() }
  }, [perfil, buscar])

  const totalApts = emps.reduce((s, e) => s + e.apartamentos.length, 0)

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Empreendimentos" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <Text style={e.resumo}>
          {emps.length} empreendimento{emps.length === 1 ? '' : 's'} · {totalApts} apartamento{totalApts === 1 ? '' : 's'}
        </Text>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : emps.length === 0 ? (
          <Painel titulo="">
            <Vazio titulo="Nenhum empreendimento" descricao="Nada cadastrado ainda." />
          </Painel>
        ) : emps.map(emp => {
          const expandido = aberto === emp.id
          return (
            <View key={emp.id} style={e.cartao}>
              <Pressable
                style={e.cabecalho}
                onPress={() => setAberto(expandido ? null : emp.id)}
                android_ripple={{ color: CORES.areia }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={e.nome}>{emp.nome}</Text>
                  <Text style={e.contagem}>
                    {emp.apartamentos.length} apartamento{emp.apartamentos.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={e.chevron}>{expandido ? '▴' : '▾'}</Text>
              </Pressable>

              {expandido && emp.apartamentos.map((a, i) => (
                <View key={a.id} style={[e.apt, i === emp.apartamentos.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={e.aptNumero}>Apto {a.numero}</Text>
                    {a.nome_proprietario ? (
                      <Text style={e.aptDono} numberOfLines={1}>{a.nome_proprietario}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[e.selo, a.tipo_gestao === 'adm' ? e.seloAdm : e.seloSub]}>
                      <Text style={[e.seloTexto, { color: a.tipo_gestao === 'adm' ? '#1d4ed8' : '#7e22ce' }]}>
                        {(a.tipo_gestao ?? '—').toUpperCase()}
                      </Text>
                    </View>
                    {a.taxa_repasse != null && (
                      <Text style={e.taxa}>
                        {a.taxa_repasse}% s/ {a.tipo_repasse === 'faturamento' ? 'fat.' : 'lucro'}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )
        })}

        <Text style={e.aviso}>
          Cadastro e edição de imóveis continuam no sistema web.
        </Text>
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  resumo: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco, marginBottom: 16 },

  cartao: {
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
  },
  cabecalho: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 15,
  },
  nome: { fontFamily: FONTES.semi, fontSize: 14.5, color: CORES.texto },
  contagem: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 2 },
  chevron: { fontSize: 13, color: CORES.textoApagado },

  apt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: '#f1f2f5',
    borderBottomWidth: 0,
    backgroundColor: '#fbfcfd',
  },
  aptNumero: { fontFamily: FONTES.media, fontSize: 13, color: CORES.texto },
  aptDono: { fontFamily: FONTES.regular, fontSize: 11, color: CORES.textoApagado, marginTop: 1 },
  selo: { borderRadius: 100, paddingHorizontal: 9, paddingVertical: 2 },
  seloAdm: { backgroundColor: '#eff6ff' },
  seloSub: { backgroundColor: '#faf5ff' },
  seloTexto: { fontFamily: FONTES.bold, fontSize: 10 },
  taxa: { fontFamily: FONTES.regular, fontSize: 10.5, color: CORES.textoApagado, marginTop: 3 },

  aviso: {
    fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado,
    textAlign: 'center', marginTop: 16,
  },
  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})
