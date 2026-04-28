import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { assertEnv } from './auth.js'
import { registerFinanceiroTools } from './tools/financeiro.js'
import { registerImportacaoTools } from './tools/importacao.js'
import { registerImoveisTools } from './tools/imoveis.js'
import { registerMonitoramentoTools } from './tools/monitoramento.js'

assertEnv([
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ALUGUEASY_BASE_URL',
])

const server = new McpServer({
  name: 'alugueasy',
  version: '1.0.0',
})

registerFinanceiroTools(server)
registerImportacaoTools(server)
registerImoveisTools(server)
registerMonitoramentoTools(server)

const transport = new StdioServerTransport()

server.connect(transport).then(() => {
  process.stderr.write('AlugEasy MCP Server v1.0.0 — pronto\n')
}).catch((err: Error) => {
  process.stderr.write(`Erro fatal ao iniciar MCP Server: ${err.message}\n`)
  process.exit(1)
})
