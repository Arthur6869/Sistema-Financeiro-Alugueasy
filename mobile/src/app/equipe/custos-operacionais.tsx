import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAtualizarAoFocar } from '@/lib/usar-atualizacao'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES } from '@/constants/tema'
import { EquipeTopo } from '@/components/equipe-nav'
import { FiltroPeriodo } from '@/components/filtro-periodo'
import { Painel } from '@/components/painel'
import { KpiCard } from '@/components/kpi-card'

// Tabela de custos fixos — igual à do site, que também a mantém no código e não
// no banco (`components/custos-operacionais/custos-operacionais-client.tsx:8-22`).
const CUSTO_DIARIA = 250.0
const FIXOS = [
  { categoria: 'Pessoal & Limpeza', item: 'Salário fixo — Limpeza', qtd: 1, unitario: 3100.0 },
  { categoria: 'Pessoal & Limpeza', item: 'Salários — Limpeza', qtd: 4, unitario: 2500.0 },
  { categoria: 'Operacional', item: 'Atendimento', qtd: 1, unitario: 2765.44 },
  { categoria: 'Operacional', item: 'Manutenção', qtd: 1, unitario: 4000.0 },
  { categoria: 'Operacional', item: 'Financeiro', qtd: 1, unitario: 1500.0 },
  { categoria: 'Infraestrutura', item: 'Aluguel', qtd: 1, unitario: 1800.0 },
  { categoria: 'Infraestrutura', item: 'Condomínio', qtd: 1, unitario: 980.0 },
  { categoria: 'Contratos & Licenças', item: 'Softwares', qtd: 1, unitario: 3500.0 },
  { categoria: 'Contratos & Licenças', item: 'Consórcio (cota A)', qtd: 3, unitario: 2602.82 },
  { categoria: 'Contratos & Licenças', item: 'Consórcio (cota B)', qtd: 1, unitario: 1058.42 },
]
const TOTAL_FIXO = FIXOS.reduce((s, f) => s + f.qtd * f.unitario, 0)

export default function CustosOperacionais() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const podeEditar = perfil?.role === 'analista'

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [diarias, setDiarias] = useState('0')
  const [salvo, setSalvo] = useState('0')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const { data, error } = await supabase
        .from('custos_operacionais_variaveis')
        .select('diarias').eq('mes', mes).eq('ano', ano).maybeSingle()
      if (error) throw error
      const v = String(data?.diarias ?? 0)
      setDiarias(v); setSalvo(v)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')
    } finally {
      setCarregando(false)
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

  async function salvar() {
    const qtd = parseInt(diarias || '0', 10)
    if (!Number.isFinite(qtd) || qtd < 0) { setErro('Quantidade inválida.'); return }

    setSalvando(true); setErro('')
    const { data, error } = await supabase
      .from('custos_operacionais_variaveis')
      .upsert({ mes, ano, diarias: qtd, updated_at: new Date().toISOString() }, { onConflict: 'mes,ano' })
      .select()
    setSalvando(false)

    if (error) { setErro(error.message); return }
    if (!data || data.length === 0) { setErro('Você não tem permissão para alterar este valor.'); return }
    setSalvo(String(qtd))
  }

  const qtd = parseInt(diarias || '0', 10) || 0
  const totalVariavel = qtd * CUSTO_DIARIA
  const totalGeral = TOTAL_FIXO + totalVariavel
  const alterado = diarias !== salvo

  const categorias = [...new Set(FIXOS.map(f => f.categoria))]

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Custos operacionais" papel={perfil?.role} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text style={e.subtitulo}>Despesas fixas e variáveis de {MESES[mes - 1]} {ano}</Text>

        <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

        <View style={e.grade}>
          <KpiCard
            rotulo="Total fixo mensal" valor={`R$ ${formatBRL(TOTAL_FIXO)}`}
            rodape="custos recorrentes" corBarra="#f87171"
            icone="▤" corIconeFundo="#fef2f2" estilo={e.meia}
          />
          <KpiCard
            rotulo="Custo por diária" valor={`R$ ${formatBRL(CUSTO_DIARIA)}`}
            rodape="limpeza avulsa" corBarra="#fb923c"
            icone="◈" corIconeFundo="#fff7ed" estilo={e.meia}
          />
        </View>

        <KpiCard
          rotulo="Total com diárias" valor={`R$ ${formatBRL(totalGeral)}`}
          rodape={`${qtd} diária${qtd === 1 ? '' : 's'} × R$ ${formatBRL(CUSTO_DIARIA)}`}
          corBarra="#3b82f6" corValor="#1d4ed8"
          icone="↗" corIconeFundo="#eff6ff"
          estilo={{ marginTop: 12, marginBottom: 16 }}
        />

        <Painel titulo="Diárias avulsas no mês" subtitulo={`Limpezas variáveis — R$ ${formatBRL(CUSTO_DIARIA)} por diária`}>
          {carregando ? (
            <ActivityIndicator color={CORES.azul} />
          ) : (
            <>
              <View style={e.linhaQtd}>
                <Text style={e.rotuloQtd}>Quantidade</Text>
                <TextInput
                  style={[e.campoQtd, !podeEditar && e.campoDesabilitado]}
                  value={diarias}
                  onChangeText={t => setDiarias(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  editable={podeEditar && !salvando}
                />
              </View>

              <View style={e.linhaTotal}>
                <Text style={e.rotuloTotal}>Total variável</Text>
                <Text style={e.valorTotal}>R$ {formatBRL(totalVariavel)}</Text>
              </View>

              {erro !== '' && <Text style={e.textoErro}>{erro}</Text>}

              {podeEditar && alterado && (
                <Pressable style={e.botaoSalvar} onPress={salvar} disabled={salvando}>
                  {salvando
                    ? <ActivityIndicator size="small" color={CORES.branco} />
                    : <Text style={e.botaoSalvarTexto}>Salvar</Text>}
                </Pressable>
              )}

              {!podeEditar && (
                <Text style={e.avisoLeitura}>
                  Seu acesso é somente leitura.
                </Text>
              )}
            </>
          )}
        </Painel>

        <Painel titulo="Detalhamento por categoria">
          {categorias.map(cat => {
            const itens = FIXOS.filter(f => f.categoria === cat)
            const subtotal = itens.reduce((s, i) => s + i.qtd * i.unitario, 0)
            return (
              <View key={cat}>
                <View style={e.linhaCategoria}>
                  <Text style={e.categoriaNome}>{cat}</Text>
                  <Text style={e.categoriaTotal}>R$ {formatBRL(subtotal)}</Text>
                </View>
                {itens.map(i => (
                  <View key={i.item} style={e.linhaItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={e.itemNome}>{i.item}</Text>
                      {i.qtd > 1 && (
                        <Text style={e.itemQtd}>{i.qtd} × R$ {formatBRL(i.unitario)}</Text>
                      )}
                    </View>
                    <Text style={e.itemValor}>R$ {formatBRL(i.qtd * i.unitario)}</Text>
                  </View>
                ))}
              </View>
            )
          })}

          <View style={e.linhaCategoria}>
            <Text style={e.categoriaNome}>Pessoal & Limpeza — Variável</Text>
            <Text style={e.categoriaTotal}>R$ {formatBRL(totalVariavel)}</Text>
          </View>
          <View style={e.linhaItem}>
            <Text style={[e.itemNome, { flex: 1 }]}>Diárias avulsas</Text>
            <Text style={e.itemValor}>R$ {formatBRL(totalVariavel)}</Text>
          </View>

          <View style={e.linhaGeral}>
            <Text style={e.geralRotulo}>Total geral</Text>
            <Text style={e.geralValor}>R$ {formatBRL(totalGeral)}</Text>
          </View>
        </Painel>
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco, marginBottom: 16 },
  grade: { flexDirection: 'row', gap: 12 },
  meia: { flex: 1 },

  linhaQtd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  rotuloQtd: { fontFamily: FONTES.media, fontSize: 13.5, color: '#374151' },
  campoQtd: {
    width: 96, borderWidth: 1, borderColor: CORES.borda, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, textAlign: 'right',
    fontFamily: FONTES.semi, fontSize: 14, color: CORES.texto, backgroundColor: CORES.branco,
  },
  campoDesabilitado: { backgroundColor: '#f9fafb', color: CORES.textoApagado },

  linhaTotal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#f1f2f5', paddingTop: 12,
  },
  rotuloTotal: { fontFamily: FONTES.media, fontSize: 13, color: CORES.textoFraco },
  valorTotal: { fontFamily: FONTES.bold, fontSize: 15, color: '#ea580c' },

  botaoSalvar: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 16,
  },
  botaoSalvarTexto: { fontFamily: FONTES.bold, fontSize: 13.5, color: CORES.branco },
  avisoLeitura: {
    fontFamily: FONTES.regular, fontSize: 12, color: CORES.textoApagado,
    textAlign: 'center', marginTop: 14,
  },
  textoErro: { fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.vermelho, marginTop: 10 },

  linhaCategoria: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f9fafb', paddingHorizontal: 12, paddingVertical: 9,
    marginTop: 10, borderRadius: 8,
  },
  categoriaNome: { fontFamily: FONTES.bold, fontSize: 11.5, color: CORES.texto },
  categoriaTotal: { fontFamily: FONTES.bold, fontSize: 12, color: CORES.texto },

  linhaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  itemNome: { fontFamily: FONTES.regular, fontSize: 12.5, color: '#4b5563' },
  itemQtd: { fontFamily: FONTES.regular, fontSize: 10.5, color: CORES.textoApagado, marginTop: 1 },
  itemValor: { fontFamily: FONTES.media, fontSize: 12.5, color: '#374151' },

  linhaGeral: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 2, borderTopColor: CORES.borda, marginTop: 12, paddingTop: 12,
  },
  geralRotulo: { fontFamily: FONTES.bold, fontSize: 13.5, color: CORES.texto },
  geralValor: { fontFamily: FONTES.bold, fontSize: 17, color: CORES.texto },
})
