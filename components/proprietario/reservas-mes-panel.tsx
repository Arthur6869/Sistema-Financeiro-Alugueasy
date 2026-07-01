import { CalendarDays, TrendingUp } from 'lucide-react'

type Reserva = {
  booking_id: string
  individual_room_name: string | null
  checkin: string | null
  checkout: string | null
  plataforma_normalizada: string | null
  valor_liquido: number | null
  status: string | null
  nome_hospede: string | null
}

type Props = {
  reservas: Reserva[]
  mes: number
  ano: number
  nomeMes: string
  sincronizado: boolean
}

// LGPD: exibe apenas o primeiro nome do hóspede.
// nome_hospede no banco tem formato "Nome Sobrenome — +55..." — telefone mascarado.
function primeiroNome(raw: string | null): string {
  if (!raw) return 'Hóspede'
  const semTelefone = raw.split(' — ')[0].trim()
  const nome = semTelefone.split(' ')[0] ?? ''
  return nome
    ? nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase()
    : 'Hóspede'
}

function formatData(s: string | null): string {
  if (!s) return '?'
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

function formatBRL(v: number | null): string {
  if (v == null) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const PLATAFORMA_COR: Record<string, { bg: string; text: string; label: string }> = {
  alugueasy: { bg: '#e6f1fb', text: '#0c447c', label: 'AlugEasy' },
  booking:   { bg: '#e8f0fe', text: '#1a56db', label: 'Booking' },
  airbnb:    { bg: '#ffe4e6', text: '#be123c', label: 'Airbnb' },
  expedia:   { bg: '#fef3c7', text: '#92400e', label: 'Expedia' },
}

function getPlataforma(raw: string | null) {
  const key = (raw ?? '').toLowerCase().trim()
  return PLATAFORMA_COR[key] ?? { bg: '#f1f5f9', text: '#475569', label: raw ?? '—' }
}

function aptShort(roomName: string | null): string {
  if (!roomName) return '—'
  // "Easy 117" → "Easy 117"; "Cullinan 803" → "Cullinan 803"
  return roomName.trim()
}

export function ReservasMesPanel({ reservas, nomeMes, ano, sincronizado }: Props) {
  if (!reservas || reservas.length === 0) {
    return (
      <div style={{
        background: '#fff', border: '1px solid #e7e9ee', borderRadius: 18,
        padding: 24, marginBottom: 20,
      }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: '#0f1a2e',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <CalendarDays size={16} color="#193660" />
          Reservas de {nomeMes ? `${nomeMes} ${ano}` : ano}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '32px 20px', textAlign: 'center',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#f8f6f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, color: '#94a3b8',
          }}>
            <CalendarDays size={20} />
          </div>
          {sincronizado ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f1a2e', marginBottom: 4 }}>
                Nenhuma reserva em {nomeMes ? `${nomeMes} ${ano}` : ano}
              </div>
              <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
                Sincronização realizada — não há reservas ativas neste período.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f1a2e', marginBottom: 4 }}>
                Dados de {nomeMes ? `${nomeMes} ${ano}` : ano} ainda não carregados
              </div>
              <div style={{ fontSize: 12.5, color: '#94a3b8' }}>
                Clique em <strong style={{ color: '#193660' }}>Atualizar dados</strong> para buscar as reservas deste mês diretamente da Amenitiz.
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  const totalValor = reservas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

  // Agrupar por plataforma para o mini-breakdown
  const porPlat: Record<string, { count: number; total: number }> = {}
  for (const r of reservas) {
    const k = (r.plataforma_normalizada ?? 'Outros').toLowerCase()
    if (!porPlat[k]) porPlat[k] = { count: 0, total: 0 }
    porPlat[k].count++
    porPlat[k].total += Number(r.valor_liquido ?? 0)
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #e7e9ee', borderRadius: 18,
      padding: 24, marginBottom: 20,
      fontFamily: 'DM Sans, sans-serif',
    }}>
      {/* Cabeçalho */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 18,
      }}>
        <div>
          <div style={{
            fontSize: 15, fontWeight: 600, color: '#0f1a2e',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CalendarDays size={16} color="#193660" />
            Reservas de {nomeMes ? `${nomeMes} ${ano}` : ano}
            <span style={{
              background: '#e6f1fb', color: '#0c447c',
              borderRadius: 20, padding: '2px 10px',
              fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
            }}>
              {reservas.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
            Total líquido: <span style={{ color: '#166534', fontWeight: 600 }}>{formatBRL(totalValor)}</span>
          </div>
        </div>

        {/* Breakdown por plataforma */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(porPlat)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([key, { count, total }]) => {
              const p = getPlataforma(key)
              return (
                <div key={key} style={{
                  background: p.bg, borderRadius: 8, padding: '5px 10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  minWidth: 64,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: p.text, letterSpacing: '.04em' }}>
                    {p.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: p.text }}>
                    {count}×
                  </span>
                  <span style={{ fontSize: 9.5, color: p.text, opacity: .8 }}>
                    {formatBRL(total)}
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {/* Tabela de reservas */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e7e9ee' }}>
              {['Imóvel', 'Check-in', 'Check-out', 'Plataforma', 'Hóspede', 'Valor líquido'].map(h => (
                <th key={h} style={{
                  padding: '6px 10px', textAlign: 'left',
                  fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: '#94a3b8',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reservas.map((r, idx) => {
              const plat = getPlataforma(r.plataforma_normalizada)
              const isLast = idx === reservas.length - 1
              return (
                <tr
                  key={r.booking_id}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                    transition: 'background .1s',
                  }}
                >
                  {/* Imóvel */}
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{
                      background: '#f1f5f9', color: '#0f1a2e',
                      borderRadius: 6, padding: '3px 8px',
                      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {aptShort(r.individual_room_name)}
                    </span>
                  </td>

                  {/* Check-in */}
                  <td style={{ padding: '10px 10px', color: '#0f1a2e', fontWeight: 500 }}>
                    {formatData(r.checkin)}
                  </td>

                  {/* Check-out */}
                  <td style={{ padding: '10px 10px', color: '#5a6a82' }}>
                    {formatData(r.checkout)}
                  </td>

                  {/* Plataforma */}
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{
                      background: plat.bg, color: plat.text,
                      borderRadius: 5, padding: '2px 8px',
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
                      whiteSpace: 'nowrap',
                    }}>
                      {plat.label}
                    </span>
                  </td>

                  {/* Hóspede — LGPD: apenas primeiro nome */}
                  <td style={{ padding: '10px 10px', color: '#5a6a82' }}>
                    {primeiroNome(r.nome_hospede)}
                  </td>

                  {/* Valor */}
                  <td style={{
                    padding: '10px 10px', textAlign: 'right',
                    color: '#166534', fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    {formatBRL(r.valor_liquido)}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Rodapé com total */}
          <tfoot>
            <tr style={{ borderTop: '2px solid #e7e9ee' }}>
              <td colSpan={5} style={{
                padding: '10px 10px',
                fontSize: 11, fontWeight: 700, color: '#94a3b8',
                letterSpacing: '.04em', textTransform: 'uppercase',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <TrendingUp size={12} /> Total ({reservas.length} reservas)
                </span>
              </td>
              <td style={{
                padding: '10px 10px', textAlign: 'right',
                fontSize: 14, fontWeight: 700, color: '#166534',
              }}>
                {formatBRL(totalValor)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
