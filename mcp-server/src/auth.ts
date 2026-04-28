/**
 * Auth utilities for the AlugEasy MCP server.
 *
 * The MCP server always uses the Supabase service role key, which bypasses
 * Row Level Security (RLS). This is intentional: agents need unrestricted
 * read access to produce accurate KPIs and reports.
 *
 * Do NOT use the anon key here — it would silently return empty result sets
 * for tables that require an authenticated user via RLS.
 */

export function assertEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `AlugEasy MCP server is missing required environment variables:\n` +
        missing.map((k) => `  • ${k}`).join('\n') +
        `\n\nCopy mcp-server/.env.example to mcp-server/.env and fill in the values.`
    )
  }
}
