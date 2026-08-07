import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TextInput, Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAtualizarAoFocar } from '@/lib/usar-atualizacao'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES, plataforma, nomeCurto } from '@/constants/tema'
import { EquipeNav, EquipeTopo } from '@/components/equipe-nav'
import { FiltroPeriodo } from '@/components/filtro-periodo'
import { Resumo } from '@/components/tabela'
import { EditarValorModal } from '@/components/editar-valor-modal'
import { Painel, Vazio } from '@/components/painel'

type Reserva = {
  id: string
  booking_id: string | null
  checkin: string | null
  checkout: string | null
  valor_bruto: number | null
  valor_liquido: number | null
  plataforma_normalizada: string | null
  individual_room_number: string | null
  nome_hospede: string | null
}

export default function Reservas() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const podeEditar = perfil?.role === 'analista'

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [linhas, setLinhas] = useState<Reserva[]>([])
  const [busca, setBusca] = useState('')
  const [emEdicao, setEmEdicao] = useState<Reserva | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      // O site filtra por mes_competencia/ano_competencia (e não por data de
      // check-in) — manter igual para os números baterem com a tela do web.
      const { data, error } = await supabase
        .from('amenitiz_reservas')
        .select('id, booking_id, checkin, checkout, valor_bruto, valor_liquido, plataforma_normalizada, individual_room_number, nome_hospede')
        .eq('mes_competencia', mes).eq('ano_competencia', ano)
        .order('checkin', { ascending: true })
      if (error) throw error
      setLinhas((data ?? []) as unknown as Reserva[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as reservas.')
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

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return linhas
    return linhas.filter(r =>
      (r.nome_hospede ?? '').toLowerCase().includes(termo)
      || (r.individual_room_number ?? '').toLowerCase().includes(termo)
      || (r.plataforma_normalizada ?? '').toLowerCase().includes(termo)
      || (r.booking_id ?? '').toLowerCase().includes(termo))
  }, [linhas, busca])

  const totalLiquido = filtradas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

  async function salvar(valores: Record<string, string>): Promise<string | null> {
    if (!emEdicao) return 'Registro não encontrado.'
    const bruto = Number((valores.valor_bruto ?? '').replace(',', '.'))
    const liquido = Number((valores.valor_liquido ?? '').replace(',', '.'))

    // Mesmas validações do site (`reservas-editavel-tabela.tsx:146-148`).
    if (!Number.isFinite(bruto) || bruto < 0) return 'Valor bruto inválido.'
    if (!Number.isFinite(liquido) || liquido < 0) return 'Valor líquido inválido.'
    if (liquido > bruto) return 'Valor líquido não pode ser maior que o bruto.'

    const { data, error } = await supabase
      .from('amenitiz_reservas')
      .update({ valor_bruto: bruto, valor_liquido: liquido })
      .eq('id', emEdicao.id)
      .select()
    if (error) return error.message
    if (!data || data.length === 0) return 'Você não tem permissão para editar reservas.'
    await buscar()
    return null
  }

  async function excluir(): Promise<string | null> {
    if (!emEdicao) return 'Registro não encontrado.'
    const { data, error } = await supabase
      .from('amenitiz_reservas').delete().eq('id', emEdicao.id).select()
    if (error) return error.message
    if (!data || data.length === 0) return 'Você não tem permissão para excluir reservas.'
    await buscar()
    return null
  }

  function dataCurta(iso: string | null): string {
    const [, m, d] = (iso ?? '').split('-')
    return d ? `${d}/${m}` : '?'
  }

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Reservas" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

        <Resumo itens={[
          { rotulo: 'Reservas', valor: String(filtradas.length) },
          { rotulo: 'Líquido', valor: `R$ ${formatBRL(totalLiquido)}` },
        ]} />

        <TextInput
          style={e.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar hóspede, quarto ou plataforma..."
          placeholderTextColor={CORES.textoApagado}
        />

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <Painel titulo={`Reservas Amenitiz — ${MESES[mes - 1]}`}>
            {filtradas.length === 0 ? (
              <Vazio
                titulo="Nenhuma reserva encontrada"
                descricao="Ajuste a busca ou o período selecionado."
              />
            ) : filtradas.map(r => {
              const cfg = plataforma(r.plataforma_normalizada)
              return (
                <Pressable
                  key={r.id}
                  style={e.item}
                  onPress={podeEditar ? () => setEmEdicao(r) : undefined}
                  android_ripple={podeEditar ? { color: CORES.areia } : undefined}
                >
                  <View style={[e.plataforma, { backgroundColor: cfg.bg, borderColor: cfg.borda }]}>
                    <Text style={[e.plataformaTexto, { color: cfg.texto }]}>{cfg.label}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={e.hospede} numberOfLines={1}>{nomeCurto(r.nome_hospede)}</Text>
                    <Text style={e.detalhe} numberOfLines={1}>
                      {r.individual_room_number ?? '—'} · {dataCurta(r.checkin)} → {dataCurta(r.checkout)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={e.liquido}>R$ {formatBRL(Number(r.valor_liquido ?? 0))}</Text>
                    {r.valor_bruto != null && (
                      <Text style={e.bruto}>bruto {formatBRL(Number(r.valor_bruto))}</Text>
                    )}
                  </View>

                  {podeEditar && <Text style={e.seta}>›</Text>}
                </Pressable>
              )
            })}
          </Painel>
        )}

        {!podeEditar && (
          <Text style={e.avisoLeitura}>
            Seu acesso é somente leitura. Ajustes de valor são feitos por uma conta de analista.
          </Text>
        )}
      </ScrollView>

      {emEdicao && (
        <EditarValorModal
          visivel
          titulo="Editar reserva"
          subtitulo={`${nomeCurto(emEdicao.nome_hospede)} · ${dataCurta(emEdicao.checkin)} → ${dataCurta(emEdicao.checkout)}`}
          campos={[
            { chave: 'valor_bruto', rotulo: 'Valor bruto (R$)', valor: String(emEdicao.valor_bruto ?? ''), tipo: 'numero' },
            { chave: 'valor_liquido', rotulo: 'Valor líquido (R$)', valor: String(emEdicao.valor_liquido ?? ''), tipo: 'numero' },
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
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16,
    fontFamily: FONTES.regular, fontSize: 14, color: CORES.texto,
    backgroundColor: CORES.branco,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
  },
  plataforma: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  plataformaTexto: { fontFamily: FONTES.bold, fontSize: 9.5 },
  hospede: { fontFamily: FONTES.semi, fontSize: 13, color: CORES.texto },
  detalhe: { fontFamily: FONTES.regular, fontSize: 11, color: CORES.textoApagado, marginTop: 2 },
  liquido: { fontFamily: FONTES.bold, fontSize: 13, color: '#166534' },
  bruto: { fontFamily: FONTES.regular, fontSize: 10.5, color: CORES.textoApagado, marginTop: 1 },
  seta: { fontSize: 18, color: CORES.textoApagado },

  avisoLeitura: {
    fontFamily: FONTES.regular, fontSize: 12, color: CORES.textoApagado,
    textAlign: 'center', marginTop: 16, lineHeight: 18,
  },
  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})
