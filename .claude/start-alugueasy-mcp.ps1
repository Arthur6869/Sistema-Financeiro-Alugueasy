$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$mcpEnvFile = Join-Path $repoRoot "mcp-server\.env"
$fallbackEnvFile = Join-Path $repoRoot ".env.local"

function Load-DotEnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) { return $false }

  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') {
      $key = $matches[1]
      $value = $matches[2].Trim()
      if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }

  return $true
}

# Fonte oficial do MCP
$loaded = Load-DotEnvFile -Path $mcpEnvFile

# Compatibilidade retroativa para instalações antigas
if (-not $loaded) {
  $loaded = Load-DotEnvFile -Path $fallbackEnvFile
}

if (-not $loaded) {
  throw "Arquivo de ambiente não encontrado. Crie 'mcp-server/.env' com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ALUGUEASY_BASE_URL."
}

$serverEntry = Join-Path $repoRoot "mcp-server\dist\index.js"
node $serverEntry
