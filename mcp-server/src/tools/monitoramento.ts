import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Registers monitoring / health-check tools on the MCP server.
 *
 * Tools in this module:
 *   - health_check       → verifies database connectivity and table accessibility
 *   - margin_alerts      → lists apartments whose margin is below a threshold
 *   - sync_status        → last successful Amenitiz sync timestamp and record counts
 */
export function registerMonitoramentoTools(_server: McpServer): void {
  // Tools will be registered here in the next implementation step
}
