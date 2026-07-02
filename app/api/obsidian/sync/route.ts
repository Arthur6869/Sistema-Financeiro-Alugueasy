import { NextRequest, NextResponse } from 'next/server'
import { requireAnalista } from '@/lib/api-auth'
import { isInternalApiRequest } from '@/lib/internal-api-auth'
import { syncProjectContextToObsidian } from '@/lib/obsidian'

type SyncBody = {
  notePath?: string
  includeFiles?: string[]
}

function sanitizeBody(body: unknown): SyncBody {
  if (!body || typeof body !== 'object') return {}
  const raw = body as Record<string, unknown>

  const includeFiles = Array.isArray(raw.includeFiles)
    ? raw.includeFiles.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined

  return {
    notePath: typeof raw.notePath === 'string' ? raw.notePath : undefined,
    includeFiles,
  }
}

/**
 * POST /api/obsidian/sync
 *
 * Sincroniza um resumo de contexto do projeto para uma nota no Obsidian local
 * via API em OBSIDIAN_API_BASE (padrão: https://127.0.0.1:27124).
 *
 * Autorização:
 * - chamadas internas (x-alugueasy-internal-key): permitido
 * - usuários autenticados do sistema: apenas role = 'analista'
 */
export async function POST(request: NextRequest) {
  try {
    const body = sanitizeBody(await request.json().catch(() => ({})))

    if (!isInternalApiRequest(request)) {
      const { response } = await requireAnalista()
      if (response) return response
    }

    const result = await syncProjectContextToObsidian({
      notePath: body.notePath,
      includeFiles: body.includeFiles,
    })

    return NextResponse.json({
      success: true,
      message: 'Contexto sincronizado com Obsidian com sucesso.',
      ...result,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
