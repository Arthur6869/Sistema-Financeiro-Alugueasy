const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)
const raizDoSistema = path.resolve(__dirname, '..')

/**
 * Permite que o app importe código do sistema web pelo prefixo `@sistema/`.
 *
 * O objetivo é não duplicar REGRA DE NEGÓCIO. `lib/calcular-kpis.ts` é
 * TypeScript puro — sem React, sem Next, sem acesso a banco — então o mesmo
 * arquivo que gera os números do portal e do PDF gera os números do aplicativo.
 * Copiar esse arquivo para cá criaria duas verdades sobre quanto o proprietário
 * recebe, e uma delas ficaria desatualizada.
 *
 * Só importe daqui o que for de fato agnóstico de plataforma. Qualquer coisa que
 * toque `next/*`, `@/lib/supabase/server` ou APIs de navegador quebra o bundle.
 */
config.watchFolders = [path.join(raizDoSistema, 'lib')]

config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(raizDoSistema, 'node_modules'),
]

config.resolver.extraNodeModules = {
  '@sistema': path.join(raizDoSistema, 'lib'),
}

module.exports = config
