import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { assertEnv } from './auth.js'
import { registerFinanceiroTools } from './tools/financeiro.js'
import { registerImportacaoTools } from './tools/importacao.js'
import { registerImoveisTools } from './tools/imoveis.js'
import { registerMonitoramentoTools } from './tools/monitoramento.js'
import { registerResources } from './resources.js'
import { registerPrompts } from './prompts.js'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID, timingSafeEqual } from 'node:crypto'

// A chave interna é obrigatória: o servidor HTTP usa a service role, então
// subir sem chave significaria liberar a base inteira para a internet.
assertEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALUGUEASY_INTERNAL_API_KEY'])

const PORT = parseInt(process.env.MCP_PORT ?? '3001', 10)
const INTERNAL_KEY = Buffer.from(process.env.ALUGUEASY_INTERNAL_API_KEY ?? '', 'utf8')

const transports = new Map<string, StreamableHTTPServerTransport>()

// Fail-closed e em tempo constante (mesma regra de lib/internal-key.ts do app).
function authenticate(req: IncomingMessage): boolean {
  const header = req.headers['x-alugueasy-internal-key']
  if (INTERNAL_KEY.length === 0 || typeof header !== 'string' || !header) return false
  const recebido = Buffer.from(header, 'utf8')
  if (recebido.length !== INTERNAL_KEY.length) return false
  return timingSafeEqual(recebido, INTERNAL_KEY)
}

async function buildServer(): Promise<McpServer> {
  const server = new McpServer({ name: 'alugueasy', version: '1.0.0' })
  registerFinanceiroTools(server)
  registerImportacaoTools(server)
  registerImoveisTools(server)
  registerMonitoramentoTools(server)
  registerResources(server)
  registerPrompts(server)
  return server
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Sem CORS: clientes MCP não são navegadores, e liberar origem `*` deixaria
  // qualquer site tentar a chave a partir do navegador de quem o visita.
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', server: 'alugueasy-mcp', version: '1.0.0' }))
    return
  }

  if (req.url !== '/mcp') {
    res.writeHead(404); res.end('Not found'); return
  }

  if (!authenticate(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  try {
    const sessionId = (req.headers['mcp-session-id'] as string) ?? randomUUID()

    let transport = transports.get(sessionId)
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        onsessioninitialized: (id) => {
          transports.set(id, transport!)
          process.stderr.write(`[MCP HTTP] Nova sessão: ${id}\n`)
        },
      })
      transport.onclose = () => {
        transports.delete(sessionId)
        process.stderr.write(`[MCP HTTP] Sessão encerrada: ${sessionId}\n`)
      }
      const server = await buildServer()
      await server.connect(transport)
    }

    await transport.handleRequest(req, res)

  } catch (err) {
    process.stderr.write(`[MCP HTTP] Erro: ${(err as Error).message}\n`)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  }
})

httpServer.listen(PORT, () => {
  process.stderr.write(`AlugEasy MCP HTTP Server v1.0.0 — http://localhost:${PORT}/mcp\n`)
  process.stderr.write(`Health check: http://localhost:${PORT}/health\n`)
})
