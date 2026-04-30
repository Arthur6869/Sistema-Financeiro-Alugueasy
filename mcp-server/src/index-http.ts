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
import { randomUUID } from 'node:crypto'

assertEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

const PORT = parseInt(process.env.MCP_PORT ?? '3001', 10)
const INTERNAL_KEY = process.env.ALUGUEASY_INTERNAL_API_KEY ?? ''

const transports = new Map<string, StreamableHTTPServerTransport>()

function authenticate(req: IncomingMessage): boolean {
  if (!INTERNAL_KEY) return true
  const auth = req.headers['x-alugueasy-internal-key']
  return auth === INTERNAL_KEY
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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-alugueasy-internal-key, mcp-session-id')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

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
