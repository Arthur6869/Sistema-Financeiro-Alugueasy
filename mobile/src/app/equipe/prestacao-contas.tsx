import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAtualizarAoFocar } from '@/lib/usar-atualizacao'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES } from '@/constants/tema'
import { EquipeTopo } from '@/components/equipe-nav'
import { FiltroPeriodo } from '@/components/filtro-periodo'
import { AvisoImportacao } from '@/components/aviso-importacao'
import { Painel, Vazio } from '@/components/painel'
import { Resumo } from '@/components/tabela'
import { baixarPrestacaoContas } from '@/lib/baixar-pdf'
import { calcularKPIs, type KPIsResult } from '@sistema/calcular-kpis'

type Apt = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
  nome_proprietario: string | null
  empreendimentos: { nome: string } | null
}

type Linha = { apt: Apt; kpis: KPIsResult }

export default function PrestacaoContas() {
  const { perfil, carregando: carregandoAuth } = useAuth()

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [linhas, setLinhas] = useState<Linha[]>([])
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const ultimo = new Date(ano, mes, 0).getDate()
      const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`

      const [aptRes, diariasRes, custosRes, reservasRes] = await Promise.all([
        supabase.from('apartamentos')
          .select('id, numero, tipo_gestao, taxa_repasse, tipo_repasse, modelo_contrato, nome_proprietario, empreendimentos(nome)')
          .order('numero'),
        supabase.from('diarias').select('apartamento_id, valor, tipo_gestao')
          .gte('data', inicio).lte('data', fim),
        supabase.from('custos').select('apartamento_id, valor, tipo_gestao')
          .eq('mes', mes).eq('ano', ano),
        supabase.from('amenitiz_reservas').select('apartamento_id, valor_liquido, status')
          .lte('checkin', fim).gte('checkout', inicio),
      ])
      if (aptRes.error) throw aptRes.error
      if (diariasRes.error) throw diariasRes.error

      const apts = (aptRes.data ?? []) as unknown as Apt[]
      const diarias = diariasRes.data ?? []
      const custos = custosRes.data ?? []
      const reservas = reservasRes.data ?? []

      const montadas = apts.map(apt => ({
        apt,
        // Mesma função do portal e do PDF — nada de recalcular a regra aqui.
        kpis: calcularKPIs(
          diarias.filter(d => d.apartamento_id === apt.id),
          custos.filter(c => c.apartamento_id === apt.id),
          reservas.filter(r => r.apartamento_id === apt.id),
          apt,
        ),
      })).filter(l => l.kpis.receitaTotal > 0 || l.kpis.custosTotal > 0)

      setLinhas(montadas.sort((a, b) => b.kpis.receitaTotal - a.kpis.receitaTotal))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [mes, ano])

  useEffect(() => {
    if (ehEquipe(perfil)) { setCarregando(true); buscar() }
  }, [perfil, buscar])

  // Planilha importada no sistema web não dispara Realtime — só amenitiz_reservas
  // é publicada. Rebuscar ao voltar para a tela cobre esse caso.
  useAtualizarAoFocar(buscar, ehEquipe(perfil))

  function mudarMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setMes(m); setAno(a)
  }

  async function baixar(l: Linha) {
    setBaixandoId(l.apt.id); setErro('')
    const { erro: falha } = await baixarPrestacaoContas(
      l.apt.id, mes, ano,
      `prestacao-${l.apt.numero}-${String(mes).padStart(2, '0')}-${ano}`,
    )
    setBaixandoId(null)
    if (falha) setErro(falha)
  }

  const totalRepasse = linhas.reduce((s, l) => s + l.kpis.valorLiquidoProprietario, 0)
  const totalFat = linhas.reduce((s, l) => s + l.kpis.receitaTotal, 0)

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Prestação de contas" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <Text style={e.subtitulo}>Extrato por imóvel de {MESES[mes - 1]} {ano}</Text>

        <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

        <AvisoImportacao aoImportar={buscar} />

        <Resumo itens={[
          { rotulo: 'Faturamento', valor: `R$ ${formatBRL(totalFat)}` },
          { rotulo: 'A repassar', valor: `R$ ${formatBRL(totalRepasse)}` },
        ]} />

        {erro !== '' && (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        )}

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : (
          <Painel titulo={`${linhas.length} imóvel${linhas.length === 1 ? '' : 'is'} com movimento`}>
            {linhas.length === 0 ? (
              <Vazio
                titulo="Nenhum imóvel com movimento"
                descricao="Nada lançado neste período."
              />
            ) : linhas.map(l => (
              <View key={l.apt.id} style={e.item}>
                <View style={{ flex: 1 }}>
                  <Text style={e.nome} numberOfLines={1}>
                    {l.apt.empreendimentos?.nome ?? '—'} {l.apt.numero}
                  </Text>
                  {l.apt.nome_proprietario ? (
                    <Text style={e.dono} numberOfLines={1}>{l.apt.nome_proprietario}</Text>
                  ) : null}
                  <Text style={e.numeros}>
                    Fat. R$ {formatBRL(l.kpis.receitaTotal)} · custos R$ {formatBRL(l.kpis.custosTotal)}
                  </Text>
                  <Text style={e.repasse}>
                    Repasse R$ {formatBRL(l.kpis.valorLiquidoProprietario)}
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [e.botaoPdf, pressed && { opacity: 0.6 }]}
                  onPress={() => baixar(l)}
                  disabled={baixandoId === l.apt.id}
                >
                  {baixandoId === l.apt.id
                    ? <ActivityIndicator size="small" color={CORES.azul} />
                    : <Text style={e.botaoPdfTexto}>PDF</Text>}
                </Pressable>
              </View>
            ))}
          </Painel>
        )}
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
  nome: { fontFamily: FONTES.semi, fontSize: 13.5, color: CORES.texto },
  dono: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 1 },
  numeros: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoFraco, marginTop: 3 },
  repasse: { fontFamily: FONTES.bold, fontSize: 12.5, color: '#166534', marginTop: 2 },

  botaoPdf: {
    borderWidth: 1, borderColor: CORES.azul, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, minWidth: 56, alignItems: 'center',
  },
  botaoPdfTexto: { fontFamily: FONTES.bold, fontSize: 12, color: CORES.azul },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginBottom: 16 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})
