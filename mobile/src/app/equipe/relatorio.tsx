import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAtualizarAoFocar } from '@/lib/usar-atualizacao'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES_ABREV } from '@/constants/tema'
import { EquipeTopo } from '@/components/equipe-nav'
import { Painel, Vazio } from '@/components/painel'
import { AvisoImportacao } from '@/components/aviso-importacao'
import { LinhaRegistro } from '@/components/tabela'

type Mes = { label: string; mes: number; ano: number; faturamento: number; custos: number; lucro: number }

export default function Relatorio() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const [meses, setMeses] = useState<Mes[]>([])
  const [categorias, setCategorias] = useState<{ nome: string; total: number }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const agora = new Date()
      // Últimos 6 meses, do mais antigo ao atual — mesma janela do site.
      const periodos = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(agora.getFullYear(), agora.getMonth() - (5 - i), 1)
        return {
          mes: d.getMonth() + 1,
          ano: d.getFullYear(),
          label: `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        }
      })

      const inicio = `${periodos[0].ano}-${String(periodos[0].mes).padStart(2, '0')}-01`
      const ult = periodos[periodos.length - 1]
      const ultimoDia = new Date(ult.ano, ult.mes, 0).getDate()
      const fim = `${ult.ano}-${String(ult.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

      const [diariasRes, custosRes] = await Promise.all([
        supabase.from('diarias').select('valor, data').gte('data', inicio).lte('data', fim),
        supabase.from('custos').select('valor, categoria, mes, ano')
          .gte('ano', periodos[0].ano).lte('ano', ult.ano),
      ])
      if (diariasRes.error) throw diariasRes.error
      if (custosRes.error) throw custosRes.error

      const diarias = (diariasRes.data ?? []) as { valor: number | null; data: string }[]
      const custos = (custosRes.data ?? []) as { valor: number | null; categoria: string; mes: number; ano: number }[]

      setMeses(periodos.map(p => {
        const chave = `${p.ano}-${String(p.mes).padStart(2, '0')}`
        const faturamento = diarias
          .filter(d => (d.data ?? '').startsWith(chave))
          .reduce((s, d) => s + Number(d.valor ?? 0), 0)
        const custosMes = custos
          .filter(c => c.mes === p.mes && c.ano === p.ano)
          .reduce((s, c) => s + Number(c.valor ?? 0), 0)
        return { ...p, faturamento, custos: custosMes, lucro: faturamento - custosMes }
      }))

      // Custos por categoria na janela inteira
      const porCat = new Map<string, number>()
      const dentroDaJanela = new Set(periodos.map(p => `${p.ano}-${p.mes}`))
      for (const c of custos) {
        if (!dentroDaJanela.has(`${c.ano}-${c.mes}`)) continue
        porCat.set(c.categoria, (porCat.get(c.categoria) ?? 0) + Number(c.valor ?? 0))
      }
      setCategorias([...porCat.entries()]
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o relatório.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [])

  useEffect(() => {
    if (ehEquipe(perfil)) { setCarregando(true); buscar() }
  }, [perfil, buscar])

  // Planilha importada no sistema web não dispara Realtime — só amenitiz_reservas
  // é publicada. Rebuscar ao voltar para a tela cobre esse caso.
  useAtualizarAoFocar(buscar, ehEquipe(perfil))

  const maxValor = Math.max(...meses.map(m => Math.max(m.faturamento, m.custos)), 1)
  const totalCategorias = categorias.reduce((s, c) => s + c.total, 0)

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Relatório" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <Text style={e.subtitulo}>Visão consolidada dos últimos 6 meses</Text>

        <AvisoImportacao aoImportar={buscar} />

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <>
            <Painel titulo="Evolução mensal" subtitulo="Faturamento, custos e lucro">
              <View style={e.legenda}>
                <Item cor={CORES.azul} texto="Faturamento" />
                <Item cor="#ef4444" texto="Custos" />
              </View>

              <View style={e.grafico}>
                {meses.map(m => (
                  <View key={m.label} style={e.coluna}>
                    <View style={e.barras}>
                      <View style={[e.barra, {
                        height: Math.max(2, (m.faturamento / maxValor) * 120),
                        backgroundColor: CORES.azul,
                      }]} />
                      <View style={[e.barra, {
                        height: Math.max(2, (m.custos / maxValor) * 120),
                        backgroundColor: '#ef4444',
                      }]} />
                    </View>
                    <Text style={e.colunaLabel}>{m.label.split('/')[0]}</Text>
                  </View>
                ))}
              </View>
            </Painel>

            <Painel titulo="Resumo por mês">
              {meses.map(m => (
                <LinhaRegistro
                  key={m.label}
                  titulo={m.label}
                  subtitulo={`Custos R$ ${formatBRL(m.custos)}`}
                  valor={`R$ ${formatBRL(m.faturamento)}`}
                  acoes={
                    <View style={[e.pill, m.lucro >= 0 ? e.pillLucro : e.pillPrejuizo]}>
                      <Text style={[e.pillTexto, { color: m.lucro >= 0 ? '#15803d' : '#b91c1c' }]}>
                        {m.lucro >= 0 ? '+' : '−'}{formatBRL(Math.abs(m.lucro))}
                      </Text>
                    </View>
                  }
                />
              ))}
            </Painel>

            <Painel
              titulo="Custos por categoria"
              subtitulo={`Total de R$ ${formatBRL(totalCategorias)} no período`}
            >
              {categorias.length === 0 ? (
                <Vazio
                  titulo="Nenhum dado disponível"
                  descricao="Importe planilhas no sistema web para ver o relatório."
                />
              ) : categorias.map(c => (
                <LinhaRegistro
                  key={c.nome}
                  titulo={c.nome}
                  subtitulo={totalCategorias > 0
                    ? `${Math.round((c.total / totalCategorias) * 100)}% do total`
                    : undefined}
                  valor={`R$ ${formatBRL(c.total)}`}
                  valorCor="#dc2626"
                />
              ))}
            </Painel>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Item({ cor, texto }: { cor: string; texto: string }) {
  return (
    <View style={e.legendaItem}>
      <View style={[e.legendaCor, { backgroundColor: cor }]} />
      <Text style={e.legendaTexto}>{texto}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco, marginBottom: 16 },

  legenda: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaCor: { width: 9, height: 9, borderRadius: 2 },
  legendaTexto: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoFraco },

  grafico: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150 },
  coluna: { flex: 1, alignItems: 'center' },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 122 },
  barra: { width: 11, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  colunaLabel: { fontFamily: FONTES.media, fontSize: 10, color: CORES.textoApagado, marginTop: 8 },

  pill: { borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  pillLucro: { backgroundColor: '#dcfce7' },
  pillPrejuizo: { backgroundColor: '#fee2e2' },
  pillTexto: { fontFamily: FONTES.bold, fontSize: 10.5 },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})
