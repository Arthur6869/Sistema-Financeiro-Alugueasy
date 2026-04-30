import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
      const supabase = await createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()

      if (authErr || !user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'analista') {
        return NextResponse.json(
          { error: 'Apenas analistas podem executar sincronização com Obsidian' },
          { status: 403 }
        )
      }
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
