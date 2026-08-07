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

type Diaria = {
  id: string
  data: string
  valor: number
  tipo_gestao: string | null
  apartamentos: { numero: string; empreendimentos: { nome: string } | null } | null
}

type Chip = 'todos' | 'adm' | 'sub'

export default function Diarias() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const podeEditar = perfil?.role === 'analista'

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [linhas, setLinhas] = useState<Diaria[]>([])
  const [busca, setBusca] = useState('')
  const [chip, setChip] = useState<Chip>('todos')
  const [emEdicao, setEmEdicao] = useState<Diaria | null>(null)
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
      const ultimoDia = new Date(ano, mes, 0).getDate()
      // Montado à mão em vez de toISOString(): a conversão para UTC pode
      // devolver o dia anterior em fuso negativo e cortar o último dia do mês.
      const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('diarias')
        .select('id, data, valor, tipo_gestao, apartamentos(numero, empreendimentos(nome))')
        .gte('data', inicio).lte('data', fim)
        .order('data', { ascending: false })
      if (error) throw error
      setLinhas((data ?? []) as unknown as Diaria[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as diárias.')
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
    return linhas.filter(d => {
      if (chip !== 'todos' && d.tipo_gestao !== chip) return false
      if (!termo) return true
      const emp = d.apartamentos?.empreendimentos?.nome ?? ''
      const num = d.apartamentos?.numero ?? ''
      return emp.toLowerCase().includes(termo) || num.toLowerCase().includes(termo)
    })
  }, [linhas, busca, chip])

  const total = filtradas.reduce((s, d) => s + Number(d.valor ?? 0), 0)

  async function salvar(valores: Record<string, string>): Promise<string | null> {
    if (!emEdicao) return 'Registro não encontrado.'
    const valor = Number((valores.valor ?? '').replace(',', '.'))
    if (!Number.isFinite(valor) || valor < 0) return 'Valor inválido.'

    const { data, error } = await supabase
      .from('diarias').update({ valor }).eq('id', emEdicao.id).select()
    if (error) return error.message
    if (!data || data.length === 0) return 'Você não tem permissão para editar diárias.'
    await buscar()
    return null
  }

  async function excluir(): Promise<string | null> {
    if (!emEdicao) return 'Registro não encontrado.'
    const { data, error } = await supabase
      .from('diarias').delete().eq('id', emEdicao.id).select()
    if (error) return error.message
    if (!data || data.length === 0) return 'Você não tem permissão para excluir diárias.'
    await buscar()
    return null
  }

  function formatarData(iso: string): string {
    const [a, m, d] = (iso ?? '').split('-')
    return d ? `${d}/${m}/${a}` : '—'
  }

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Diárias" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

        <Resumo itens={[
          { rotulo: 'Registros', valor: String(filtradas.length) },
          { rotulo: 'Total', valor: `R$ ${formatBRL(total)}` },
        ]} />

        <TextInput
          style={e.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar empreendimento ou apt..."
          placeholderTextColor={CORES.textoApagado}
        />

        <View style={e.chips}>
          {(['todos', 'adm', 'sub'] as Chip[]).map(c => (
            <Pressable key={c} onPress={() => setChip(c)} style={[e.chip, chip === c && e.chipAtivo]}>
              <Text style={[e.chipTexto, chip === c && e.chipTextoAtivo]}>
                {c === 'todos' ? 'Todos' : c.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <Painel titulo={`Diárias de ${MESES[mes - 1]}`}>
            {filtradas.length === 0 ? (
              <Vazio
                titulo="Nenhum registro encontrado"
                descricao="Ajuste os filtros ou o período selecionado."
              />
            ) : filtradas.map(d => (
              <LinhaRegistro
                key={d.id}
                titulo={`${d.apartamentos?.empreendimentos?.nome ?? '—'} ${d.apartamentos?.numero ?? ''}`}
                subtitulo={`${formatarData(d.data)} · ${(d.tipo_gestao ?? '—').toUpperCase()}`}
                valor={`R$ ${formatBRL(Number(d.valor ?? 0))}`}
                aoTocar={podeEditar ? () => setEmEdicao(d) : undefined}
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
          titulo="Editar diária"
          subtitulo={`${emEdicao.apartamentos?.empreendimentos?.nome ?? ''} ${emEdicao.apartamentos?.numero ?? ''} · ${formatarData(emEdicao.data)}`}
          campos={[
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
  chips: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.branco,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
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
