import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TextInput, Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES } from '@/constants/tema'
import { EquipeNav, EquipeTopo } from '@/components/equipe-nav'
import { FiltroPeriodo } from '@/components/filtro-periodo'
import { LinhaRegistro, Resumo } from '@/components/tabela'
import { EditarValorModal } from '@/components/editar-valor-modal'
import { Painel, Vazio } from '@/components/painel'

type Custo = {
  id: string
  categoria: string
  valor: number
  tipo_gestao: string | null
  origem: string | null
  observacao: string | null
  apartamentos: { numero: string; empreendimentos: { nome: string } | null } | null
}

type Chip = 'todos' | 'adm' | 'sub' | 'importacao' | 'manual'

export default function Custos() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const podeEditar = perfil?.role === 'analista'

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [linhas, setLinhas] = useState<Custo[]>([])
  const [busca, setBusca] = useState('')
  const [chip, setChip] = useState<Chip>('todos')
  const [emEdicao, setEmEdicao] = useState<Custo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const { data, error } = await supabase
        .from('custos')
        .select('id, categoria, valor, tipo_gestao, origem, observacao, apartamentos(numero, empreendimentos(nome))')
        .eq('mes', mes).eq('ano', ano)
        .order('created_at', { ascending: false })
      if (error) throw error
      setLinhas((data ?? []) as unknown as Custo[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os custos.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [mes, ano])

  useEffect(() => {
    if (ehEquipe(perfil)) { setCarregando(true); buscar() }
  }, [perfil, buscar])

  function mudarMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setMes(m); setAno(a)
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return linhas.filter(c => {
      if (chip === 'adm' && c.tipo_gestao !== 'adm') return false
      if (chip === 'sub' && c.tipo_gestao !== 'sub') return false
      if (chip === 'manual' && c.origem !== 'manual') return false
      if (chip === 'importacao' && c.origem !== 'importacao') return false
      if (!termo) return true
      const emp = c.apartamentos?.empreendimentos?.nome ?? ''
      return c.categoria.toLowerCase().includes(termo) || emp.toLowerCase().includes(termo)
    })
  }, [linhas, busca, chip])

  const total = filtradas.reduce((s, c) => s + Number(c.valor ?? 0), 0)

  /**
   * A escrita vai direto ao Supabase. Depois da migration 037 só `analista`
   * escreve, e a RLS bloqueia sem levantar erro — o UPDATE apenas não casa a
   * linha. Por isso conferimos as linhas retornadas por `.select()`.
   */
  async function salvar(valores: Record<string, string>): Promise<string | null> {
    if (!emEdicao) return 'Registro não encontrado.'
    const categoria = (valores.categoria ?? '').trim()
    const valor = Number((valores.valor ?? '').replace(',', '.'))

    if (categoria.length < 2) return 'Categoria muito curta.'
    if (!Number.isFinite(valor) || valor <= 0) return 'Valor deve ser maior que zero.'

    const { data, error } = await supabase
      .from('custos')
      .update({ categoria, valor })
      .eq('id', emEdicao.id)
      .select()
    if (error) return error.message
    if (!data || data.length === 0) return 'Você não tem permissão para editar custos.'

    await buscar()
    return null
  }

  async function excluir(): Promise<string | null> {
    if (!emEdicao) return 'Registro não encontrado.'
    const { data, error } = await supabase
      .from('custos').delete().eq('id', emEdicao.id).select()
    if (error) return error.message
    if (!data || data.length === 0) return 'Você não tem permissão para excluir custos.'
    await buscar()
    return null
  }

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Custos" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

        <Resumo itens={[
          { rotulo: 'Lançamentos', valor: String(filtradas.length) },
          { rotulo: 'Total', valor: `R$ ${formatBRL(total)}` },
        ]} />

        <TextInput
          style={e.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar categoria ou empreendimento..."
          placeholderTextColor={CORES.textoApagado}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.chips}>
          {(['todos', 'adm', 'sub', 'importacao', 'manual'] as Chip[]).map(c => (
            <Pressable
              key={c}
              onPress={() => setChip(c)}
              style={[e.chip, chip === c && e.chipAtivo]}
            >
              <Text style={[e.chipTexto, chip === c && e.chipTextoAtivo]}>
                {c === 'todos' ? 'Todos' : c.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <Painel titulo={`Lançamentos de ${MESES[mes - 1]}`}>
            {filtradas.length === 0 ? (
              <Vazio
                titulo="Nenhum registro encontrado"
                descricao="Ajuste os filtros ou o período selecionado."
              />
            ) : filtradas.map(c => (
              <LinhaRegistro
                key={c.id}
                titulo={`${c.apartamentos?.empreendimentos?.nome ?? '—'} ${c.apartamentos?.numero ?? ''}`}
                subtitulo={`${c.categoria} · ${(c.tipo_gestao ?? '—').toUpperCase()}${c.origem === 'manual' ? ' · manual' : ''}`}
                valor={`R$ ${formatBRL(Number(c.valor ?? 0))}`}
                valorCor="#dc2626"
                aoTocar={podeEditar ? () => setEmEdicao(c) : undefined}
                acoes={podeEditar ? <Text style={e.seta}>›</Text> : undefined}
              />
            ))}
          </Painel>
        )}

        {!podeEditar && (
          <Text style={e.avisoLeitura}>
            Seu acesso é somente leitura. Lançamentos são feitos por uma conta de analista.
          </Text>
        )}
      </ScrollView>

      {emEdicao && (
        <EditarValorModal
          visivel
          titulo="Editar custo"
          subtitulo={`${emEdicao.apartamentos?.empreendimentos?.nome ?? ''} ${emEdicao.apartamentos?.numero ?? ''}`}
          campos={[
            { chave: 'categoria', rotulo: 'Categoria', valor: emEdicao.categoria },
            { chave: 'valor', rotulo: 'Valor (R$)', valor: String(emEdicao.valor ?? ''), tipo: 'numero' },
          ]}
          permiteExcluir
          aoSalvar={salvar}
          aoExcluir={excluir}
          aoFechar={() => setEmEdicao(null)}
        />
      )}

      <EquipeNav />
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  busca: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12,
    fontFamily: FONTES.regular, fontSize: 14, color: CORES.texto,
    backgroundColor: CORES.branco,
  },
  chips: { gap: 8, paddingBottom: 16 },
  chip: {
    borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.branco,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipAtivo: { backgroundColor: CORES.azul, borderColor: CORES.azul },
  chipTexto: { fontFamily: FONTES.media, fontSize: 12, color: '#4b5563' },
  chipTextoAtivo: { color: CORES.branco },

  seta: { fontSize: 20, color: CORES.textoApagado, marginLeft: 6 },
  avisoLeitura: {
    fontFamily: FONTES.regular, fontSize: 12, color: CORES.textoApagado,
    textAlign: 'center', marginTop: 16, lineHeight: 18,
  },
  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})
