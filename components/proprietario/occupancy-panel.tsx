import { CalendarDays } from 'lucide-react'
import { getTaxasPlataforma } from '@/lib/amenitiz'

type Reserva = {
  booking_id: string
  checkin: string | null
  checkout: string | null
  plataforma_normalizada: string | null
  valor_liquido: number | null
  nome_hospede: string | null
  apartamento_id: string
}

type Apto = {
  id: string
  numero: string
  empreendimento: string | null
}

type Props = {
  apartamentos: Apto[]
  reservas: Reserva[]
  mes: number
  ano: number
  nomeMes: string
  sincronizado: boolean
}

type PCfg = { label: string; bg: string; border: string; accent: string; text: string }

const PLATS: Record<string, PCfg> = {
  airbnb:    { label: 'Airbnb',      bg: '#fff0f0', border: '#fcc5ce', accent: '#e31c5f', text: '#9f1239' },
  booking:   { label: 'Booking.com', bg: '#dbeafe', border: '#93c5fd', accent: '#1d4ed8', text: '#1e40af' },
  expedia:   { label: 'Expedia',     bg: '#fef3c7', border: '#fde68a', accent: '#d97706', text: '#92400e' },
  alugueasy: { label: 'AlugEasy',    bg: '#e6edf5', border: '#c3d5e8', accent: '#193660', text: '#0f2647' },
}
const DEFAULT_PLAT: PCfg = { label: 'Outro', bg: '#f1f2f5', border: '#e7e9ee', accent: '#64748b', text: '#475569' }
const LEGEND_ORDER = ['airbnb', 'booking', 'alugueasy', 'expedia']

function getPCfg(plat: string | null): PCfg {
  return PLATS[(plat ?? '').toLowerCase().trim()] ?? DEFAULT_PLAT
}

function iniciais(raw: string | null): string {
  const s = (raw ?? '').split(' — ')[0].trim().split(' ').filter(Boolean)
  return ((s[0]?.[0] ?? '') + (s[1]?.[0] ?? '')).toUpperCase() || 'H'
}

function nomeEx(raw: string | null): string {
  const s = (raw ?? '').split(' — ')[0].trim().split(' ').filter(Boolean)
  if (!s.length) return 'Hóspede'
  const n = s[0].charAt(0).toUpperCase() + s[0].slice(1).toLowerCase()
  return s.length > 1 ? `${n} ${s[s.length - 1].charAt(0).toUpperCase()}.` : n
}

function dNum(d: string | null): number | null {
  if (!d) return null
  const n = parseInt(d.split('-')[2] ?? '0')
  return isNaN(n) ? null : n
}

function fBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fPct(v: number): string {
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

const MES_ABR = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fDia(d: string | null) {
  if (!d) return { d: '?', m: '?' }
  const [, mm, dd] = d.split('-')
  return { d: dd ?? '?', m: MES_ABR[(parseInt(mm ?? '1') - 1)] ?? '?' }
}

export function OccupancyPanel({ apartamentos, reservas, mes, ano, nomeMes, sincronizado }: Props) {
  const totalDays = mes > 0 ? new Date(ano, mes, 0).getDate() : 30
  const showGrid = mes > 0

  const totalFat = reservas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

  const byApt: Record<string, Reserva[]> = {}
  for (const r of reservas) {
    if (!byApt[r.apartamento_id]) byApt[r.apartamento_id] = []
    byApt[r.apartamento_id].push(r)
  }

  const usedPlatSet = new Set(reservas.map(r => (r.plataforma_normalizada ?? '').toLowerCase().trim()))
  const usedPlats = LEGEND_ORDER.filter(p => usedPlatSet.has(p))

  if (reservas.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 18, padding: 24, marginBottom: 20, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: '#0f1a2e', marginBottom: 12 }}>
          <CalendarDays size={16} color="#193660" />
          Ocupação de {nomeMes || ano}
        </div>
        <div style={{ textAlign: 'center', padding: '24px 20px', fontSize: 13, color: '#94a3b8' }}>
          {sincronizado
            ? 'Nenhuma reserva neste período.'
            : 'Clique em Atualizar dados para sincronizar as reservas deste mês.'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e7e9ee', borderRadius: 18, marginBottom: 20, overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Cabeçalho global */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 24px', borderBottom: '1px solid #e7e9ee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarDays size={16} color="#193660" />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0f1a2e' }}>Ocupação de {nomeMes || ano}</span>
          <span style={{ background: '#e6f1fb', color: '#0c447c', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>
            {reservas.length} reservas
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {usedPlats.map(p => {
            const c = PLATS[p]!
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent }} />
                <span style={{ fontSize: 11.5, color: '#5a6a82' }}>{c.label}</span>
              </div>
            )
          })}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0f1a2e' }}>R$ {fBRL(totalFat)}</span>
      </div>

      {/* Por apartamento */}
      {apartamentos.map((apt, aptIdx) => {
        const aptRes = byApt[apt.id] ?? []
        if (aptRes.length === 0 && apartamentos.length > 1) return null

        // Mapa de dias ocupados
        const dayMap: Record<number, { plat: string; hospede: string; isCheckin: boolean }> = {}
        if (showGrid) {
          for (const r of aptRes) {
            const ci = dNum(r.checkin) ?? 1
            const co = dNum(r.checkout) ?? (totalDays + 1)
            for (let d = ci; d < co && d <= totalDays; d++) {
              dayMap[d] = { plat: r.plataforma_normalizada ?? '', hospede: r.nome_hospede ?? '', isCheckin: d === ci }
            }
          }
        }

        const noites = showGrid
          ? Object.keys(dayMap).length
          : aptRes.reduce((s, r) => { const ci = dNum(r.checkin) ?? 0; const co = dNum(r.checkout) ?? 0; return s + Math.max(0, co - ci) }, 0)
        const pct = showGrid ? Math.round((noites / totalDays) * 100) : 0
        const fatApt = aptRes.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

        const statsRow: [string, string, string][] = [
          ['RESERVAS', String(aptRes.length), '#0f1a2e'],
          ['NOITES', String(noites), '#0f1a2e'],
          ...(showGrid ? [['OCUPAÇÃO', `${pct}%`, '#16a34a'] as [string, string, string]] : []),
          ['FATURAMENTO', `R$ ${fBRL(fatApt)}`, '#0f1a2e'],
        ]

        // Taxas de plataforma do apartamento (Booking varia por empreendimento;
        // Airbnb respeita a vigência do período exibido — 0% até mai/2026)
        const taxas = getTaxasPlataforma(apt.empreendimento ?? '', apt.numero, { mes, ano })
        const taxasItens: { key: string; nome: string; pct: number }[] = [
          { key: 'booking',   nome: 'Booking',  pct: taxas.booking },
          { key: 'airbnb',    nome: 'Airbnb',   pct: taxas.airbnb },
          { key: 'alugueasy', nome: 'AlugEasy', pct: taxas.alugueasy },
        ]

        return (
          <div key={apt.id} style={{ borderTop: aptIdx > 0 ? '8px solid #f4f5f7' : undefined }}>

            {/* Header do apartamento */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, padding: '14px 24px', borderBottom: '1px solid #f1f2f5', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#0f1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '.01em', flexShrink: 0 }}>
                  {apt.numero}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f1a2e' }}>Apto {apt.numero}</div>
                  {apt.empreendimento && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{apt.empreendimento}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                {statsRow.map(([lbl, val, col]) => (
                  <div key={lbl} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 2 }}>{lbl}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: col }}>{val}</div>
                  </div>
                ))}
                {/* Taxas de plataforma — badge por plataforma com a cor da legenda */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 3 }}>TAXAS</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {taxasItens.map(t => {
                      const c = PLATS[t.key] ?? DEFAULT_PLAT
                      return (
                        <span
                          key={t.key}
                          title={`Taxa ${c.label}: ${fPct(t.pct)}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: c.bg, border: `1px solid ${c.border}`, color: c.text, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.accent, display: 'inline-block' }} />
                          {t.nome} {fPct(t.pct)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Grade de dias + barra */}
            {showGrid && (
              <div style={{ padding: '14px 20px 6px', overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalDays}, minmax(26px, 1fr))`, gap: 3, minWidth: 580 }}>
                  {Array.from({ length: totalDays }, (_, i) => {
                    const d = i + 1
                    const info = dayMap[d]
                    const cfg = info ? getPCfg(info.plat) : null
                    return (
                      <div
                        key={d}
                        title={info ? `${getPCfg(info.plat).label} — ${nomeEx(info.hospede)}` : `Dia ${d} — Livre`}
                        style={{ position: 'relative', aspectRatio: '1', background: cfg ? cfg.bg : '#f4f5f7', border: `1px solid ${cfg ? cfg.border : '#e7e9ee'}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: info ? 600 : 400, color: cfg ? cfg.text : '#c4ccd8', userSelect: 'none' }}
                      >
                        {d}
                        {info?.isCheckin && (
                          <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: cfg?.accent ?? '#94a3b8', display: 'block' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* Barra de ocupação */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 12, minWidth: 580 }}>
                  <div style={{ flex: 1, height: 5, background: '#f1f2f5', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', borderRadius: 100 }} />
                  </div>
                  <span style={{ fontSize: 10.5, color: '#5a6a82', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {noites} de {totalDays} noites
                  </span>
                </div>
              </div>
            )}

            {/* Cards de reservas */}
            {aptRes.length > 0 && (
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 20px 20px', scrollbarWidth: 'thin' }}>
                {aptRes.map(r => {
                  const cfg = getPCfg(r.plataforma_normalizada)
                  const ci = dNum(r.checkin)
                  const co = dNum(r.checkout)
                  const nCard = ci && co ? Math.max(0, co - ci) : 0
                  const ent = fDia(r.checkin)
                  const sai = fDia(r.checkout)
                  return (
                    <div key={r.booking_id} style={{ minWidth: 210, maxWidth: 210, border: `1px solid ${cfg.border}`, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: '#fff' }}>
                      {/* Header do card */}
                      <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}`, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: cfg.text, background: 'rgba(255,255,255,.65)', borderRadius: 20, padding: '2px 8px' }}>{nCard}n</span>
                      </div>
                      {/* Corpo */}
                      <div style={{ padding: '14px 14px 12px' }}>
                        {/* Hóspede */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: cfg.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, flexShrink: 0, letterSpacing: '.03em' }}>
                            {iniciais(r.nome_hospede)}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {nomeEx(r.nome_hospede)}
                          </span>
                        </div>
                        {/* Datas */}
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 3 }}>ENTRADA</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f1a2e', lineHeight: 1 }}>{ent.d}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{ent.m}</div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 8px', paddingBottom: 10 }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.accent, flexShrink: 0 }} />
                            <div style={{ flex: 1, height: 1.5, background: cfg.accent, opacity: .4 }} />
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.accent, flexShrink: 0 }} />
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 3 }}>SAÍDA</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f1a2e', lineHeight: 1 }}>{sai.d}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sai.m}</div>
                          </div>
                        </div>
                        {/* Valor */}
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f2f5', textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#166534' }}>
                          R$ {fBRL(r.valor_liquido ?? 0)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
