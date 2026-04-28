import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { assertEnv } from './auth.js'
import { registerFinanceiroTools } from './tools/financeiro.js'
import { registerImportacaoTools } from './tools/importacao.js'
import { registerImoveisTools } from './tools/imoveis.js'
import { registerMonitoramentoTools } from './tools/monitoramento.js'

assertEnv()

const server = new McpServer({
  name: 'alugueasy',
  version: '1.0.0',
})

registerFinanceiroTools(server)
registerImportacaoTools(server)
registerImoveisTools(server)
registerMonitoramentoTools(server)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // MCP stdio servers must not write to stdout (it is the transport channel).
  // Use stderr for diagnostic output only.
  console.error('AlugEasy MCP server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error starting AlugEasy MCP server:', err)
  process.exit(1)
})
