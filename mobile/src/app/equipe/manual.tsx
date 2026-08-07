import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES } from '@/constants/tema'
import { EquipeTopo } from '@/components/equipe-nav'
import { FiltroPeriodo } from '@/components/filtro-periodo'
import { Painel, Vazio } from '@/components/painel'
import { LinhaRegistro } from '@/components/tabela'

// Mesma lista do site (`components/custos/manual-cost-form.tsx:7-18`).
const CATEGORIAS = [
  'Amenitiz', 'Condomínio', 'Energia', 'Água', 'Lavanderia',
  'Limpeza', 'Manutenção', 'Internet', 'Gás', 'Outros',
]

type Apt = {
  id: string
  numero: string
  empreendimento_id: string
  tipo_gestao: string | null
  empreendimentos: { nome: string } | null
}

type Lancamento = {
  id: string
  categoria: string
  valor: number
  observacao: string | null
  apartamentos: { numero: string; empreendimentos: { nome: string } | null } | null
}

export default function LancamentoManual() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const podeEditar = perfil?.role === 'analista'

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [gestao, setGestao] = useState<'adm' | 'sub'>('adm')

  const [apts, setApts] = useState<Apt[]>([])
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])

  const [aptId, setAptId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const [aptRes, lancRes] = await Promise.all([
        supabase.from('apartamentos')
          .select('id, numero, empreendimento_id, tipo_gestao, empreendimentos(nome)')
          .order('numero'),
        supabase.from('custos')
          .select('id, categoria, valor, observacao, apartamentos(numero, empreendimentos(nome))')
          .eq('mes', mes).eq('ano', ano).eq('origem', 'manual')
          .order('created_at', { ascending: false }),
      ])
      if (aptRes.error) throw aptRes.error
      if (lancRes.error) throw lancRes.error
      setApts((aptRes.data ?? []) as unknown as Apt[])
      setLancamentos((lancRes.data ?? []) as unknown as Lancamento[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')
    } finally {
      setCarregando(false)
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

  // O site só oferece apartamentos cujo tipo_gestao bate com o contexto.
  const aptsDisponiveis = useMemo(
    () => apts.filter(a => (a.tipo_gestao ?? gestao) === gestao),
    [apts, gestao],
  )

  async function salvar() {
    setErro(''); setSucesso('')

    const v = Number(valor.replace(',', '.'))
    if (!aptId) { setErro('Selecione o apartamento.'); return }
    if (!categoria) { setErro('Selecione a categoria.'); return }
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor maior que zero.'); return }

    setSalvando(true)
    const { data, error } = await supabase.from('custos').insert({
      apartamento_id: aptId,
      mes, ano,
      categoria,
      valor: v,
      tipo_gestao: gestao,
      origem: 'manual',
      observacao: observacao.trim() || null,
      criado_por: null,
    }).select()
    setSalvando(false)

    if (error) {
      setErro(error.code === '23505'
        ? 'Já existe um custo idêntico nesta competência.'
        : error.message)
      return
    }
    if (!data || data.length === 0) {
      setErro('Você não tem permissão para lançar custos.')
      return
    }

    setSucesso('Custo lançado com sucesso.')
    setAptId(''); setValor(''); setObservacao('')
    await buscar()
  }

  const nomeApt = (a: Apt) => `${a.empreendimentos?.nome ?? '—'} ${a.numero}`

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Lançamento manual" papel={perfil?.role} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text style={e.subtitulo}>
            Registre um custo direto no sistema. A importação por planilha continua no web.
          </Text>

          <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

          {!podeEditar ? (
            <View style={e.avisoLeitura}>
              <Text style={e.avisoTitulo}>Acesso somente leitura</Text>
              <Text style={e.avisoTexto}>
                Apenas analistas podem criar, editar ou excluir lançamentos.
                Você pode consultar os lançamentos do período abaixo.
              </Text>
            </View>
          ) : (
            <Painel titulo="Novo lançamento" subtitulo={`${MESES[mes - 1]} ${ano}`}>
              <Text style={e.rotulo}>Gestão</Text>
              <View style={e.chips}>
                {(['adm', 'sub'] as const).map(g => (
                  <Pressable
                    key={g}
                    onPress={() => { setGestao(g); setAptId('') }}
                    style={[e.chip, gestao === g && e.chipAtivo]}
                  >
                    <Text style={[e.chipTexto, gestao === g && e.chipTextoAtivo]}>{g.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={e.rotulo}>Apartamento</Text>
              {carregando ? (
                <ActivityIndicator color={CORES.azul} />
              ) : (
                <ScrollView style={e.seletorLista} nestedScrollEnabled>
                  {aptsDisponiveis.length === 0 ? (
                    <Text style={e.vazioSeletor}>Nenhum apartamento nesta gestão.</Text>
                  ) : aptsDisponiveis.map(a => (
                    <Pressable
                      key={a.id}
                      onPress={() => setAptId(a.id)}
                      style={[e.opcao, aptId === a.id && e.opcaoAtiva]}
                    >
                      <Text style={[e.opcaoTexto, aptId === a.id && e.opcaoTextoAtivo]}>
                        {nomeApt(a)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <Text style={e.rotulo}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={e.chips}>
                {CATEGORIAS.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setCategoria(c)}
                    style={[e.chip, categoria === c && e.chipAtivo]}
                  >
                    <Text style={[e.chipTexto, categoria === c && e.chipTextoAtivo]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={e.rotulo}>Valor (R$)</Text>
              <TextInput
                style={e.campo}
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={CORES.textoApagado}
                editable={!salvando}
              />

              <Text style={e.rotulo}>Observação (opcional)</Text>
              <TextInput
                style={e.campo}
                value={observacao}
                onChangeText={setObservacao}
                placeholder="Detalhes do lançamento"
                placeholderTextColor={CORES.textoApagado}
                editable={!salvando}
              />

              {erro !== '' && <Text style={e.textoErro}>{erro}</Text>}
              {sucesso !== '' && <Text style={e.textoSucesso}>{sucesso}</Text>}

              <Pressable
                style={({ pressed }) => [e.botao, (pressed || salvando) && { opacity: 0.7 }]}
                onPress={salvar}
                disabled={salvando}
              >
                {salvando
                  ? <ActivityIndicator size="small" color={CORES.branco} />
                  : <Text style={e.botaoTexto}>Salvar custo</Text>}
              </Pressable>
            </Painel>
          )}

          <Painel titulo="Lançamentos manuais do período" subtitulo={`${lancamentos.length} registro${lancamentos.length === 1 ? '' : 's'}`}>
            {lancamentos.length === 0 ? (
              <Vazio
                titulo="Nenhum lançamento encontrado"
                descricao="Nada lançado à mão neste período."
              />
            ) : lancamentos.map(l => (
              <LinhaRegistro
                key={l.id}
                titulo={`${l.apartamentos?.empreendimentos?.nome ?? '—'} ${l.apartamentos?.numero ?? ''}`}
                subtitulo={`${l.categoria}${l.observacao ? ` · ${l.observacao}` : ''}`}
                valor={`R$ ${formatBRL(Number(l.valor ?? 0))}`}
                valorCor="#dc2626"
              />
            ))}
          </Painel>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco, marginBottom: 16, lineHeight: 19 },

  rotulo: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: CORES.textoApagado,
    marginBottom: 8, marginTop: 6,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.branco,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
  },
  chipAtivo: { backgroundColor: CORES.azul, borderColor: CORES.azul },
  chipTexto: { fontFamily: FONTES.media, fontSize: 12.5, color: '#4b5563' },
  chipTextoAtivo: { color: CORES.branco },

  seletorLista: {
    maxHeight: 160, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 10, marginBottom: 12,
  },
  opcao: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f1f2f5' },
  opcaoAtiva: { backgroundColor: '#e6f1fb' },
  opcaoTexto: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.texto },
  opcaoTextoAtivo: { fontFamily: FONTES.semi, color: '#0c447c' },
  vazioSeletor: { fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.textoApagado, padding: 14 },

  campo: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4,
    fontFamily: FONTES.regular, fontSize: 15, color: CORES.texto,
    backgroundColor: '#fbfcfd',
  },

  textoErro: { fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.vermelho, marginTop: 10 },
  textoSucesso: { fontFamily: FONTES.semi, fontSize: 12.5, color: '#15803d', marginTop: 10 },

  botao: {
    backgroundColor: CORES.azul, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  botaoTexto: { fontFamily: FONTES.bold, fontSize: 14, color: CORES.branco },

  avisoLeitura: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  avisoTitulo: { fontFamily: FONTES.semi, fontSize: 13, color: '#92400e', marginBottom: 4 },
  avisoTexto: { fontFamily: FONTES.regular, fontSize: 12.5, color: '#92400e', lineHeight: 19 },
})
