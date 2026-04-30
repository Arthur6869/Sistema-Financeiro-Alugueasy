import { promises as fs } from 'fs'
import https from 'https'
import path from 'path'

const DEFAULT_OBSIDIAN_API_BASE = 'https://127.0.0.1:27124'
const DEFAULT_NOTE_PATH = 'AlugEasy/Sistema-Financeiro-Contexto.md'
const MAX_CONTENT_CHARS = 300_000
const DEFAULT_CONTEXT_FILES = [
  'README.md',
  'AGENTS.md',
  'documentação.md',
  'CLAUDE.md',
]

type SyncContextInput = {
  notePath?: string
  includeFiles?: string[]
}

type SyncContextResult = {
  notePath: string
  apiBase: string
  filesIncluded: string[]
  charsSent: number
}

function getObsidianConfig() {
  const apiBase = process.env.OBSIDIAN_API_BASE ?? DEFAULT_OBSIDIAN_API_BASE
  const apiToken = process.env.OBSIDIAN_API_TOKEN

  return {
    apiBase: apiBase.replace(/\/$/, ''),
    apiToken,
  }
}

function sanitizeRelativePath(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized) return null
  if (normalized.includes('..')) return null
  return normalized
}

async function readTextFileSafe(relativeFilePath: string): Promise<string | null> {
  const absolutePath = path.join(process.cwd(), relativeFilePath)

  try {
    const stat = await fs.stat(absolutePath)
    if (!stat.isFile()) return null
    if (stat.size > 2_000_000) return null

    const content = await fs.readFile(absolutePath, 'utf-8')
    return content
  } catch {
    return null
  }
}

function buildProjectTreeBlock(lines: string[]): string {
  return [
    '## Estrutura Principal',
    '',
    '```',
    ...lines,
    '```',
  ].join('\n')
}

async function getMainDirectoriesAndFiles(): Promise<string[]> {
  const entries = await fs.readdir(process.cwd(), { withFileTypes: true })

  const importantDirs = ['app', 'components', 'lib', 'mcp-server', 'supabase']
  const importantFiles = ['README.md', 'documentação.md', 'AGENTS.md', 'package.json', 'proxy.ts']

  const lines: string[] = ['.']

  for (const dirname of importantDirs) {
    if (entries.some((entry) => entry.name === dirname && entry.isDirectory())) {
      lines.push(`|-- ${dirname}/`)
    }
  }

  for (const filename of importantFiles) {
    if (entries.some((entry) => entry.name === filename && entry.isFile())) {
      lines.push(`|-- ${filename}`)
    }
  }

  return lines
}

async function buildContextMarkdown(includeFiles: string[]): Promise<{ markdown: string; filesIncluded: string[] }> {
  const now = new Date().toISOString()
  const filesIncluded: string[] = []
  const sections: string[] = []

  for (const candidateFile of includeFiles) {
    const sanitized = sanitizeRelativePath(candidateFile)
    if (!sanitized) continue

    const content = await readTextFileSafe(sanitized)
    if (!content) continue

    filesIncluded.push(sanitized)
    sections.push(
      `## Arquivo: ${sanitized}`,
      '',
      '```md',
      content.trimEnd(),
      '```',
      ''
    )
  }

  const treeLines = await getMainDirectoriesAndFiles()
  const treeBlock = buildProjectTreeBlock(treeLines)

  const markdown = [
    '# Contexto do Sistema Financeiro AlugEasy',
    '',
    `Atualizado em: ${now}`,
    '',
    'Este documento foi gerado automaticamente pela API interna do projeto para servir como contexto no Obsidian.',
    '',
    treeBlock,
    '',
    ...sections,
  ].join('\n')

  return {
    markdown: markdown.slice(0, MAX_CONTENT_CHARS),
    filesIncluded,
  }
}

async function writeNoteToObsidian(apiBase: string, apiToken: string, notePath: string, markdown: string) {
  const encodedNotePath = notePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')
  const targetUrl = `${apiBase}/vault/${encodedNotePath}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'text/markdown; charset=utf-8',
  }

  // Compatibilidade com implementações diferentes de API local do Obsidian.
  const putResponse = await requestObsidian(targetUrl, 'PUT', headers, markdown)

  if (putResponse.ok) return

  const postResponse = await requestObsidian(targetUrl, 'POST', headers, markdown)

  if (postResponse.ok) return

  const putBody = await putResponse.text().catch(() => '')
  const postBody = await postResponse.text().catch(() => '')
  throw new Error(
    `Falha ao gravar nota no Obsidian (${putResponse.status}/${postResponse.status}). ` +
      `PUT: ${putBody || 'sem resposta'} | POST: ${postBody || 'sem resposta'}`
  )
}

type ObsidianHttpResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
}

async function requestObsidian(
  targetUrl: string,
  method: 'PUT' | 'POST',
  headers: Record<string, string>,
  body: string
): Promise<ObsidianHttpResponse> {
  try {
    const res = await fetch(targetUrl, { method, headers, body })
    return {
      ok: res.ok,
      status: res.status,
      text: async () => res.text(),
    }
  } catch (error) {
    const url = new URL(targetUrl)
    const isLocalHttps = url.protocol === 'https:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')

    if (!isLocalHttps) {
      throw error
    }

    // Fallback para APIs locais com certificado self-signed do Obsidian.
    return requestLocalHttpsInsecure(targetUrl, method, headers, body)
  }
}

function requestLocalHttpsInsecure(
  targetUrl: string,
  method: 'PUT' | 'POST',
  headers: Record<string, string>,
  body: string
): Promise<ObsidianHttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      targetUrl,
      {
        method,
        headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8')
          resolve({
            ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
            status: res.statusCode ?? 500,
            text: async () => responseBody,
          })
        })
      }
    )

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function syncProjectContextToObsidian(input: SyncContextInput): Promise<SyncContextResult> {
  const { apiBase, apiToken } = getObsidianConfig()
  if (!apiToken) {
    throw new Error('Defina OBSIDIAN_API_TOKEN no .env.local para habilitar a integração com Obsidian.')
  }

  const notePath = sanitizeRelativePath(input.notePath ?? DEFAULT_NOTE_PATH)
  if (!notePath) {
    throw new Error('notePath inválido. Use um caminho relativo, sem "..".')
  }

  const includeFiles = (input.includeFiles && input.includeFiles.length > 0)
    ? input.includeFiles
    : DEFAULT_CONTEXT_FILES

  const { markdown, filesIncluded } = await buildContextMarkdown(includeFiles)
  await writeNoteToObsidian(apiBase, apiToken, notePath, markdown)

  return {
    notePath,
    apiBase,
    filesIncluded,
    charsSent: markdown.length,
  }
}
