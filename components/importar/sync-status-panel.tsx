'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, AlertTriangle, CheckCircle2, Link2Off, Loader2, RefreshCw } from 'lucide-react'
import { MESES } from '@/lib/constants'

type UltimoSync = {
  status: string
  mes: number
  ano: number
  total_reservas: number | null
  updated_at: string | null
  created_at: string
}

type AptSemRoomId = {
  numero: string
  empreendimentos: { nome: string } | null
}

export function SyncStatusPanel() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [ultimoSync, setUltimoSync] = useState<UltimoSync | null>(null)
  const [reservasSemVinculo, setReservasSemVinculo] = useState(0)
  const [aptsSemRoomId, setAptsSemRoomId] = useState<AptSemRoomId[]>([])

  const carregar = useCallback(async () => {
    const [syncRes, semVinculoRes, semRoomIdRes] = await Promise.all([
      supabase
        .from('amenitiz_syncs')
        .select('status, mes, ano, total_reservas, updated_at, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('amenitiz_reservas')
        .select('booking_id', { count: 'exact', head: true })
        .is('apartamento_id', null),
      supabase
        .from('apartamentos')
        .select('numero, empreendimentos(nome)')
        .is('amenitiz_room_id', null)
        .order('numero'),
    ])
    setUltimoSync((syncRes.data as UltimoSync | null) ?? null)
    setReservasSemVinculo(semVinculoRes.count ?? 0)
    setAptsSemRoomId(((semRoomIdRes.data ?? []) as unknown as AptSemRoomId[]))
    setLoading(false)
  }, [supabase])

  const atualizar = useCallback(() => {
    setLoading(true)
    void carregar()
  }, [carregar])

  useEffect(() => {
    void Promise.resolve().then(carregar)
  }, [carregar])

  const temPendencias = reservasSemVinculo > 0 || aptsSemRoomId.length > 0
  const syncOk = ultimoSync?.status === 'concluido'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#19366018' }}>
            <Activity size={20} style={{ color: '#193660' }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Reconciliação de Dados</h2>
            <p className="text-xs text-gray-500">
              Status do sync Amenitiz e pendências que deixam faturamento invisível
            </p>
          </div>
        </div>
        <button
          onClick={atualizar}
          disabled={loading}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Atualizar"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Loader2 size={16} className="animate-spin" /> Verificando...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Último sync */}
          <div className={`rounded-xl border p-4 ${syncOk ? 'border-green-100 bg-green-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
            <div className="flex items-center gap-2 mb-1">
              {syncOk
                ? <CheckCircle2 size={15} className="text-green-500" />
                : <AlertTriangle size={15} className="text-amber-500" />}
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Último sync</span>
            </div>
            {ultimoSync ? (
              <>
                <p className="text-sm font-semibold text-gray-900">
                  {MESES[ultimoSync.mes - 1]} {ultimoSync.ano} — {ultimoSync.status}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ultimoSync.total_reservas ?? 0} reservas ·{' '}
                  {new Date(ultimoSync.updated_at ?? ultimoSync.created_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Nenhum sync registrado</p>
            )}
          </div>

          {/* Reservas sem vínculo */}
          <div className={`rounded-xl border p-4 ${reservasSemVinculo === 0 ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'}`}>
            <div className="flex items-center gap-2 mb-1">
              {reservasSemVinculo === 0
                ? <CheckCircle2 size={15} className="text-green-500" />
                : <Link2Off size={15} className="text-red-500" />}
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Reservas sem vínculo</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {reservasSemVinculo === 0 ? 'Todas vinculadas' : `${reservasSemVinculo} reserva(s)`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {reservasSemVinculo === 0
                ? 'Todas as reservas têm apartamento identificado'
                : 'Sem apartamento_id — invisíveis no portal do proprietário'}
            </p>
          </div>

          {/* Apartamentos sem room_id */}
          <div className={`rounded-xl border p-4 ${aptsSemRoomId.length === 0 ? 'border-green-100 bg-green-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
            <div className="flex items-center gap-2 mb-1">
              {aptsSemRoomId.length === 0
                ? <CheckCircle2 size={15} className="text-green-500" />
                : <AlertTriangle size={15} className="text-amber-500" />}
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Apts sem room_id</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {aptsSemRoomId.length === 0 ? 'Todos mapeados' : `${aptsSemRoomId.length} apartamento(s)`}
            </p>
            {aptsSemRoomId.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5 break-words">
                {aptsSemRoomId
                  .map(a => `${a.empreendimentos?.nome ?? '?'} ${a.numero}`)
                  .join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {!loading && temPendencias && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          Pendências acima podem significar faturamento não contabilizado no sync. Configure os
          room_ids em Empreendimentos ou pela ferramenta MCP <code>set_amenitiz_room_id</code>.
        </p>
      )}
    </div>
  )
}
