import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Registers import / sync tools on the MCP server.
 *
 * Tools in this module:
 *   - list_importacoes      → import history with status filter
 *   - get_importacao        → details of a single import record
 *   - trigger_amenitiz_sync → trigger an Amenitiz data sync via the Next.js API
 */
export function registerImportacaoTools(_server: McpServer): void {
  // Tools will be registered here in the next implementation step
}
