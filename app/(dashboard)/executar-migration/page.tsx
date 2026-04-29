'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MIGRATION_SQL = `-- Adicionar configurações de repasse em apartamentos
ALTER TABLE apartamentos
  ADD COLUMN IF NOT EXISTS taxa_repasse numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_repasse text
    CHECK (tipo_repasse IN ('lucro', 'faturamento'))
    DEFAULT 'lucro',
  ADD COLUMN IF NOT EXISTS nome_proprietario text,
  ADD COLUMN IF NOT EXISTS modelo_contrato text
    CHECK (modelo_contrato IN ('administracao', 'sublocacao'))
    DEFAULT 'administracao';

COMMENT ON COLUMN apartamentos.taxa_repasse IS
  'Percentual de repasse ao proprietário ex: 15 para 15%';
COMMENT ON COLUMN apartamentos.tipo_repasse IS
  'Base de cálculo: lucro ou faturamento';
COMMENT ON COLUMN apartamentos.nome_proprietario IS
  'Nome completo do proprietário para o PDF';
COMMENT ON COLUMN apartamentos.modelo_contrato IS
  'administracao ou sublocacao';`

export default function MigrationPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.role !== 'analista') {
            router.push('/')
          }
        })
    })
  }, [router, supabase])

  async function runMigration() {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/run-migration', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.message?.includes('manualmente')) {
          setError(data.message)
        } else {
          setError(data.error || 'Erro ao executar migration')
        }
      } else {
        setResult({ success: true, message: data.message })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(MIGRATION_SQL)
    alert('SQL copiado para a área de transferência!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Executar Migration</h1>
        <p className="text-gray-500 mt-2">
          Adiciona colunas de repasse à tabela apartamentos
        </p>
      </div>

      <div className="grid gap-6">
        {/* Card 1: Executar via API */}
        <Card>
          <CardHeader>
            <CardTitle>Opção 1: Executar Automáticamente</CardTitle>
            <CardDescription>
              Tenta executar via API (requer função RPC no Supabase)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runMigration}
              disabled={isLoading}
              size="lg"
              className="w-full"
            >
              {isLoading ? '⏳ Executando...' : '▶️ Executar Migration'}
            </Button>

            {result?.success && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                <CheckCircle size={20} />
                <span>{result.message}</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle size={20} />
                  <span className="font-semibold">Requer execução manual</span>
                </div>
                <p className="text-sm text-amber-700">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Executar Manualmente */}
        <Card>
          <CardHeader>
            <CardTitle>Opção 2: Executar Manualmente</CardTitle>
            <CardDescription>
              Copie o SQL e execute no painel do Supabase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-x-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                {MIGRATION_SQL}
              </pre>
            </div>

            <Button
              onClick={copyToClipboard}
              variant="outline"
              className="w-full"
            >
              <Copy size={18} />
              Copiar SQL para Área de Transferência
            </Button>

            <div className="text-sm text-gray-600 space-y-2">
              <p className="font-semibold">Passos:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Acesse https://app.supabase.com/project/rlkmljeatapayiroggrp</li>
                <li>Clique em "SQL Editor" (menu lateral)</li>
                <li>Crie uma nova query</li>
                <li>Cole o SQL acima</li>
                <li>Clique em "Run"</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Valores Adicionados */}
        <Card>
          <CardHeader>
            <CardTitle>Colunas Adicionadas</CardTitle>
            <CardDescription>
              As seguintes colunas serão adicionadas à tabela apartamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="border-l-4 border-blue-500 pl-4">
                <p className="font-semibold text-blue-900">taxa_repasse</p>
                <p className="text-sm text-blue-700">numeric (padrão: 0)</p>
                <p className="text-xs text-blue-600 mt-1">
                  Percentual de repasse ao proprietário (ex: 15 para 15%)
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <p className="font-semibold text-purple-900">tipo_repasse</p>
                <p className="text-sm text-purple-700">text: 'lucro' | 'faturamento'</p>
                <p className="text-xs text-purple-600 mt-1">
                  Base de cálculo do repasse (padrão: 'lucro')
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <p className="font-semibold text-green-900">nome_proprietario</p>
                <p className="text-sm text-green-700">text</p>
                <p className="text-xs text-green-600 mt-1">
                  Nome completo do proprietário para o PDF
                </p>
              </div>

              <div className="border-l-4 border-amber-500 pl-4">
                <p className="font-semibold text-amber-900">modelo_contrato</p>
                <p className="text-sm text-amber-700">text: 'administracao' | 'sublocacao'</p>
                <p className="text-xs text-amber-600 mt-1">
                  Tipo de contrato (padrão: 'administracao')
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
