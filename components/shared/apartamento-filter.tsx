'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type ApartamentoOption = {
  id: string
  numero: string
  empreendimentoNome: string
  nomeProprietario: string | null
}

type Props = {
  apartamentos: ApartamentoOption[]
  apartamentoIdAtual: string
  mes: number
  ano: number
}

export function ApartamentoFilter({
  apartamentos,
  apartamentoIdAtual,
  mes,
  ano,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [apartamentoId, setApartamentoId] = useState(apartamentoIdAtual)

  const apartamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return apartamentos

    return apartamentos.filter((apt) => {
      return (
        apt.numero.toLowerCase().includes(termo) ||
        apt.empreendimentoNome.toLowerCase().includes(termo) ||
        String(apt.nomeProprietario ?? '').toLowerCase().includes(termo)
      )
    })
  }, [apartamentos, busca])

  const apartamentoSelecionado = useMemo(
    () => apartamentos.find((apt) => apt.id === apartamentoId) ?? null,
    [apartamentoId, apartamentos]
  )

  useEffect(() => {
    setApartamentoId(apartamentoIdAtual)
  }, [apartamentoIdAtual])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setAberto(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function atualizar(nextApartamentoId: string = apartamentoId) {
    const params = new URLSearchParams()
    params.set('apartamento_id', nextApartamentoId)
    params.set('mes', String(mes))
    params.set('ano', String(ano))
    router.push(`${pathname}?${params.toString()}`)
  }

  function selecionarApartamento(nextId: string) {
    setApartamentoId(nextId)
    setBusca('')
    setAberto(false)
    atualizar(nextId)
  }

  return (
    <div ref={wrapperRef} className="min-w-[320px] space-y-2 relative">
      <label className="block text-sm font-medium text-gray-700">Apartamento</label>
      <input
        type="text"
        value={busca}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setBusca(e.target.value)
          setAberto(true)
          setIndiceAtivo(0)
        }}
        onKeyDown={(e) => {
          if (!aberto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setAberto(true)
            return
          }
          if (!aberto || apartamentosFiltrados.length === 0) return

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIndiceAtivo((prev) => Math.min(prev + 1, apartamentosFiltrados.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIndiceAtivo((prev) => Math.max(prev - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const alvo = apartamentosFiltrados[indiceAtivo]
            if (alvo) selecionarApartamento(alvo.id)
          } else if (e.key === 'Escape') {
            setAberto(false)
          }
        }}
        placeholder="Filtrar por apto, empreendimento ou proprietário..."
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
        >
          {apartamentoSelecionado
            ? `${apartamentoSelecionado.empreendimentoNome} - Apt ${apartamentoSelecionado.numero}`
            : 'Selecione um apartamento'}
        </button>
      </div>

      {aberto && (
        <div className="absolute z-40 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {apartamentosFiltrados.length > 0 ? (
            apartamentosFiltrados.map((apt, index) => (
              <button
                key={apt.id}
                type="button"
                onMouseEnter={() => setIndiceAtivo(index)}
                onClick={() => selecionarApartamento(apt.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                  apartamentoId === apt.id || indiceAtivo === index
                    ? 'bg-[#193660]/10 text-[#193660] font-semibold'
                    : 'text-gray-800'
                }`}
              >
                <div>{apt.empreendimentoNome} - Apt {apt.numero}</div>
                {apt.nomeProprietario && (
                  <div className="text-xs text-gray-500">{apt.nomeProprietario}</div>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-gray-500">
              Nenhum apartamento encontrado para o filtro.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
