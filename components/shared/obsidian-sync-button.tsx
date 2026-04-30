'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BookText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

type SyncResponse = {
  success?: boolean
  error?: string
  message?: string
  notePath?: string
  filesIncluded?: string[]
  charsSent?: number
}

const DEFAULT_FILES = ['README.md', 'AGENTS.md', 'documentação.md']

export function ObsidianSyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [notePath, setNotePath] = useState('AlugEasy/Sistema-Financeiro-Contexto.md')
  const [result, setResult] = useState<SyncResponse | null>(null)

  async function sincronizarContexto() {
    setSyncing(true)
    setResult(null)

    try {
      const res = await fetch('/api/obsidian/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notePath,
          includeFiles: DEFAULT_FILES,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as SyncResponse
      if (!res.ok) {
        setResult({
          error: data?.error ?? `Falha HTTP ${res.status} ao sincronizar contexto`,
        })
        return
      }

      setResult(data)
    } catch (error: unknown) {
      setResult({
        error: error instanceof Error ? error.message : 'Erro de rede ao sincronizar com Obsidian',
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#19366018' }}
        >
          <BookText size={20} style={{ color: '#193660' }} />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Sincronização de Contexto — Obsidian
          </h2>
          <p className="text-xs text-gray-500">
            Gera uma nota técnica no Obsidian com o contexto do projeto para acelerar análises e reduzir leitura repetida.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={notePath}
          onChange={(event) => setNotePath(event.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[280px] flex-1"
          placeholder="AlugEasy/Sistema-Financeiro-Contexto.md"
          disabled={syncing}
        />

        <Button
          onClick={sincronizarContexto}
          disabled={syncing || !notePath.trim()}
          className="bg-[#193660] hover:bg-[#152d52] text-white"
        >
          {syncing ? <Loader2 size={15} className="mr-2 animate-spin" /> : <BookText size={15} className="mr-2" />}
          {syncing ? 'Sincronizando...' : 'Sincronizar com Obsidian'}
        </Button>
      </div>

      {result && (
        <div
          className={`mt-4 rounded-xl p-4 text-sm border ${
            result.error
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.error ? (
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 min-w-0">
              {result.error ? (
                <p className="font-semibold">Erro: {result.error}</p>
              ) : (
                <>
                  <p className="font-semibold">{result.message ?? 'Contexto sincronizado com sucesso.'}</p>
                  {result.notePath && <p>Nota: <code>{result.notePath}</code></p>}
                  {typeof result.charsSent === 'number' && <p>Caracteres enviados: {result.charsSent}</p>}
                  {result.filesIncluded && result.filesIncluded.length > 0 && (
                    <p>Arquivos: {result.filesIncluded.join(', ')}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
