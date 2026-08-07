import { useState, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { CORES, FONTES, formatBRL } from '@/constants/tema'
import { baixarPrestacaoContas } from '@/lib/baixar-pdf'
import { AlvoAlu } from '@/components/alu'

export type CustoCategoria = { categoria: string; valor: number }

export type ExtratoCardProps = {
  aptId: string
  numero: string
  empreendimento: string | null
  tipoGestao: 'adm' | 'sub' | null
  faturamento: number
  totalCustos: number
  lucro: number
  repasse: number
  valorFinal: number
  taxaRepasse: number
  tipoRepasse: 'lucro' | 'faturamento'
  custosPorCategoria: CustoCategoria[]
  semCustos: boolean
  mes: number
  ano: number
  /** Só o primeiro cartão vira alvo do tour — senão a ALU acharia vários. */
  marcarTour?: boolean
}

/**
 * Cartão de imóvel da aba Rentabilidade.
 * Espelha o markup de `app/(proprietario)/proprietario/extrato/page.tsx`
 * (`.apt-card`), não o componente `extrato-apt-card.tsx`, que está órfão no
 * repositório e tem outro visual.
 */
export function ExtratoCard(p: ExtratoCardProps) {
  const [baixando, setBaixando] = useState(false)
  const [erroPdf, setErroPdf] = useState('')
  const ehAdm = p.tipoGestao === 'adm'

  async function baixar() {
    setBaixando(true)
    setErroPdf('')
    const { erro } = await baixarPrestacaoContas(
      p.aptId, p.mes, p.ano,
      `prestacao-${p.numero}-${String(p.mes).padStart(2, '0')}-${p.ano}`,
    )
    setBaixando(false)
    if (erro) setErroPdf(erro)
  }

  const conteudo = (
    <View style={e.cartao}>
      <View style={e.cabecalho}>
        <Text style={e.nome} numberOfLines={2}>
          Apto {p.numero}{p.empreendimento ? ` — ${p.empreendimento}` : ''}
        </Text>
        <View style={[e.selo, ehAdm ? e.seloAdm : e.seloSub]}>
          <Text style={[e.seloTexto, { color: ehAdm ? '#0c447c' : '#854f0b' }]}>
            {ehAdm ? 'Administração' : 'Sublocação'}
          </Text>
        </View>
      </View>

      <View style={e.corpo}>
        <View style={e.linha}>
          <Text style={e.rotulo}>Faturamento</Text>
          <Text style={e.valor}>R$ {formatBRL(p.faturamento)}</Text>
        </View>

        <View style={e.linha}>
          <Text style={e.rotulo}>Custos</Text>
          {p.semCustos
            ? <Text style={e.valorMudo}>Não disponível</Text>
            : <Text style={[e.valor, { color: '#dc2626' }]}>− R$ {formatBRL(p.totalCustos)}</Text>}
        </View>

        {p.custosPorCategoria.map((c, i) => (
          <View
            key={`${c.categoria}-${i}`}
            style={[e.subLinha, i === p.custosPorCategoria.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={e.subEsquerda}>
              <Text style={e.seta}>↳</Text>
              <Text style={e.subRotulo} numberOfLines={1}>{c.categoria}</Text>
            </View>
            <Text style={e.subValor}>R$ {formatBRL(c.valor)}</Text>
          </View>
        ))}

        {p.semCustos && (
          <View style={e.aviso}>
            <Text style={e.avisoIcone}>⚠</Text>
            <Text style={e.avisoTexto}>
              Os custos deste período ainda não foram lançados. O lucro e o repasse
              são <Text style={e.avisoForte}>estimados</Text> e podem ser ajustados
              quando os custos forem importados.
            </Text>
          </View>
        )}

        <View style={e.linha}>
          <Text style={e.rotulo}>Lucro</Text>
          <Text style={[e.valor, { color: '#166534' }]}>R$ {formatBRL(p.lucro)}</Text>
        </View>

        <View style={[e.linha, { borderBottomWidth: 0 }]}>
          <Text style={e.rotulo}>
            Taxa AlugEasy ({p.taxaRepasse}% sobre {p.tipoRepasse === 'lucro' ? 'lucro' : 'faturamento'})
          </Text>
          <Text style={e.valorTaxa}>− R$ {formatBRL(p.repasse)}</Text>
        </View>
      </View>

      <View style={e.rodape}>
        <Marcar ativo={p.marcarTour} id="ext-repasse">
        <View style={e.rodapeEsquerda}>
          <View style={e.rodapeRotuloLinha}>
            <Text style={e.rodapeRotulo}>SEU REPASSE</Text>
            {p.semCustos && (
              <View style={e.pillEstimado}>
                <Text style={e.pillEstimadoTexto}>Estimado</Text>
              </View>
            )}
          </View>
          <Text style={e.rodapeValor}>R$ {formatBRL(p.valorFinal)}</Text>
        </View>
        </Marcar>

        <Marcar ativo={p.marcarTour} id="ext-pdf">
        <Pressable
          style={({ pressed }) => [e.botaoPdf, (pressed || baixando) && { backgroundColor: '#0f2647' }]}
          onPress={baixar}
          disabled={baixando}
        >
          {baixando
            ? <ActivityIndicator size="small" color={CORES.branco} />
            : <Text style={e.botaoPdfTexto}>↓  Baixar PDF</Text>}
        </Pressable>
        </Marcar>
      </View>

      {erroPdf !== '' && (
        <View style={e.faixaErro}><Text style={e.faixaErroTexto}>{erroPdf}</Text></View>
      )}
    </View>
  )

  return p.marcarTour ? <AlvoAlu id="ext-card">{conteudo}</AlvoAlu> : conteudo
}

/** Embrulha em AlvoAlu apenas quando este é o cartão escolhido para o tour. */
function Marcar({ ativo, id, children }: { ativo?: boolean; id: string; children: ReactNode }) {
  return ativo ? <AlvoAlu id={id}>{children}</AlvoAlu> : <>{children}</>
}

const e = StyleSheet.create({
  cartao: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 16,
    overflow: 'hidden', marginBottom: 16, backgroundColor: CORES.branco,
  },
  cabecalho: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: CORES.branco, borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  nome: { fontFamily: FONTES.bold, fontSize: 15, color: CORES.texto, flexShrink: 1 },
  selo: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  seloAdm: { backgroundColor: '#e6f1fb' },
  seloSub: { backgroundColor: '#faeeda' },
  seloTexto: { fontFamily: FONTES.semi, fontSize: 11, letterSpacing: 0.3 },

  corpo: { paddingHorizontal: 20 },
  linha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
  },
  rotulo: { fontFamily: FONTES.media, fontSize: 13.5, color: '#374151', flexShrink: 1 },
  valor: { fontFamily: FONTES.semi, fontSize: 14, color: CORES.texto },
  valorMudo: { fontFamily: FONTES.media, fontSize: 12.5, color: CORES.textoApagado, fontStyle: 'italic' },
  valorTaxa: { fontFamily: FONTES.media, fontSize: 14, color: '#6b7280' },

  subLinha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingVertical: 9, paddingLeft: 20,
    borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
  },
  subEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  seta: { fontSize: 14, color: '#d1d5db' },
  subRotulo: { fontFamily: FONTES.regular, fontSize: 12.5, color: '#6b7280', flexShrink: 1 },
  subValor: { fontFamily: FONTES.media, fontSize: 12.5, color: '#374151' },

  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 2,
  },
  avisoIcone: { fontSize: 14, color: '#b45309', marginTop: 1 },
  avisoTexto: { flex: 1, fontFamily: FONTES.regular, fontSize: 12.5, color: '#92400e', lineHeight: 19 },
  avisoForte: { fontFamily: FONTES.bold },

  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: CORES.borda,
  },
  rodapeEsquerda: { gap: 2 },
  rodapeRotuloLinha: { flexDirection: 'row', alignItems: 'center' },
  rodapeRotulo: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.8, color: '#6b7280',
  },
  pillEstimado: {
    backgroundColor: '#fef3c7', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6,
  },
  pillEstimadoTexto: { fontFamily: FONTES.bold, fontSize: 9.5, color: '#92400e' },
  rodapeValor: { fontFamily: FONTES.bold, fontSize: 22, color: '#14532d' },

  botaoPdf: {
    backgroundColor: CORES.azul, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  botaoPdfTexto: { fontFamily: FONTES.semi, fontSize: 13, color: CORES.branco },

  faixaErro: { paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#f8fafc' },
  faixaErroTexto: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.vermelho },
})
