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
import { Painel, Vazio } from '@/components/painel'
import { KpiCard } from '@/components/kpi-card'
import { LinhaRegistro } from '@/components/tabela'
import { baixarRelatorioDesempenho } from '@/lib/baixar-pdf'

type LinhaApt = {
  numero: string; emp: string
  faturamento: number; custos: number; lucro: number; margem: number
}

export default function Desempenho() {
  const { perfil, carregando: carregandoAuth } = useAuth()

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [linhas, setLinhas] = useState<LinhaApt[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [baixando, setBaixando] = useState(false)
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

      // O site não usa reservas Amenitiz aqui — só diárias. Manter igual para
      // os números baterem com a tela e com o PDF.
      const [aptRes, diariasRes, custosRes] = await Promise.all([
        supabase.from('apartamentos').select('id, numero, empreendimentos(nome)'),
        supabase.from('diarias').select('apartamento_id, valor').gte('data', inicio).lte('data', fim),
        supabase.from('custos').select('apartamento_id, valor').eq('mes', mes).eq('ano', ano),
      ])
      if (aptRes.error) throw aptRes.error
      if (diariasRes.error) throw diariasRes.error

      type Apt = { id: string; numero: string; empreendimentos: { nome: string } | null }
      const apts = (aptRes.data ?? []) as unknown as Apt[]

      const fatPorApt = new Map<string, number>()
      for (const d of diariasRes.data ?? []) {
        fatPorApt.set(d.apartamento_id, (fatPorApt.get(d.apartamento_id) ?? 0) + Number(d.valor ?? 0))
      }
      const cusPorApt = new Map<string, number>()
      for (const c of custosRes.data ?? []) {
        cusPorApt.set(c.apartamento_id, (cusPorApt.get(c.apartamento_id) ?? 0) + Number(c.valor ?? 0))
      }

      setLinhas(apts.map(a => {
        const f = fatPorApt.get(a.id) ?? 0
        const c = cusPorApt.get(a.id) ?? 0
        const lucro = f - c
        return {
          numero: a.numero,
          emp: a.empreendimentos?.nome ?? '—',
          faturamento: f, custos: c, lucro,
          margem: f > 0 ? (lucro / f) * 100 : 0,
        }
      }).filter(l => l.faturamento > 0 || l.custos > 0))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o desempenho.')
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

  async function baixarPdf() {
    setBaixando(true); setErro('')
    const { erro: falha } = await baixarRelatorioDesempenho(mes, ano)
    setBaixando(false)
    if (falha) setErro(falha)
  }

  const grandFat = linhas.reduce((s, l) => s + l.faturamento, 0)
  const grandCus = linhas.reduce((s, l) => s + l.custos, 0)
  const grandLucro = grandFat - grandCus
  const margemMedia = grandFat > 0 ? (grandLucro / grandFat) * 100 : 0

  const emLucro = linhas.filter(l => l.lucro >= 0).sort((a, b) => b.lucro - a.lucro)
  const emPrejuizo = linhas.filter(l => l.lucro < 0).sort((a, b) => a.lucro - b.lucro)

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Desempenho" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <Text style={e.subtitulo}>Rentabilidade da carteira em {MESES[mes - 1]} {ano}</Text>

        <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

        <Pressable
          style={({ pressed }) => [e.botaoPdf, (pressed || baixando) && { opacity: 0.7 }]}
          onPress={baixarPdf}
          disabled={baixando}
        >
          {baixando
            ? <ActivityIndicator size="small" color={CORES.azul} />
            : <Text style={e.botaoPdfTexto}>↓  Baixar relatório em PDF</Text>}
        </Pressable>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <>
            <View style={e.grade}>
              <KpiCard
                rotulo="Faturamento total" valor={`R$ ${formatBRL(grandFat)}`}
                rodape={MESES[mes - 1]} corBarra="#2563eb"
                icone="↗" corIconeFundo="#eff6ff" estilo={e.meia}
              />
              <KpiCard
                rotulo="Custos totais" valor={`R$ ${formatBRL(grandCus)}`}
                rodape={MESES[mes - 1]} corBarra="#dc2626"
                icone="▤" corIconeFundo="#fef2f2" estilo={e.meia}
              />
            </View>

            <View style={[e.grade, { marginTop: 12, marginBottom: 16 }]}>
              <KpiCard
                rotulo="Lucro líquido" valor={`R$ ${formatBRL(grandLucro)}`}
                rodape="no período" corBarra={grandLucro >= 0 ? '#16a34a' : '#dc2626'}
                corValor={grandLucro >= 0 ? '#16a34a' : '#dc2626'}
                icone={grandLucro >= 0 ? '↗' : '↘'}
                corIconeFundo={grandLucro >= 0 ? '#f0fdf4' : '#fef2f2'} estilo={e.meia}
              />
              <KpiCard
                rotulo="Margem média"
                valor={`${margemMedia.toFixed(1).replace('.', ',')}%`}
                rodape="sobre o faturamento"
                corBarra={margemMedia >= 0 ? '#16a34a' : '#dc2626'}
                corValor={margemMedia >= 0 ? '#16a34a' : '#dc2626'}
                icone="◈" corIconeFundo="#f0fdf4" estilo={e.meia}
              />
            </View>

            <Painel titulo={`Imóveis em lucro (${emLucro.length})`}>
              {emLucro.length === 0 ? (
                <Vazio titulo="Nenhum imóvel em lucro" descricao="Nada no período." />
              ) : emLucro.map(l => (
                <LinhaRegistro
                  key={`${l.emp}-${l.numero}`}
                  titulo={`${l.emp} ${l.numero}`}
                  subtitulo={`Fat. R$ ${formatBRL(l.faturamento)} · custos R$ ${formatBRL(l.custos)}`}
                  valor={`R$ ${formatBRL(l.lucro)}`}
                  valorCor="#16a34a"
                  acoes={
                    <View style={e.pillMargem}>
                      <Text style={e.pillMargemTexto}>{l.margem.toFixed(0)}%</Text>
                    </View>
                  }
                />
              ))}
            </Painel>

            {emPrejuizo.length > 0 && (
              <Painel titulo={`Imóveis em prejuízo (${emPrejuizo.length})`}>
                {emPrejuizo.map(l => (
                  <LinhaRegistro
                    key={`${l.emp}-${l.numero}`}
                    titulo={`${l.emp} ${l.numero}`}
                    subtitulo={`Fat. R$ ${formatBRL(l.faturamento)} · custos R$ ${formatBRL(l.custos)}`}
                    valor={`R$ ${formatBRL(l.lucro)}`}
                    valorCor="#dc2626"
                  />
                ))}
              </Painel>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco, marginBottom: 16 },
  grade: { flexDirection: 'row', gap: 12 },
  meia: { flex: 1 },

  botaoPdf: {
    borderWidth: 1, borderColor: CORES.azul, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginBottom: 18,
  },
  botaoPdfTexto: { fontFamily: FONTES.semi, fontSize: 13, color: CORES.azul },

  pillMargem: {
    backgroundColor: '#dcfce7', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8,
  },
  pillMargemTexto: { fontFamily: FONTES.bold, fontSize: 10.5, color: '#15803d' },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})
