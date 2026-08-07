/**
 * Tipagem para import estático de imagem.
 *
 * O Metro resolve `import x from './foto.png'` sozinho, mas o TypeScript não
 * conhece esses módulos e o `expo/types` não os declara. A alternativa seria
 * `require()`, que o eslint deste projeto proíbe — então a declaração vive aqui.
 */
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native'
  const conteudo: ImageSourcePropType
  export default conteudo
}

declare module '*.jpg' {
  import type { ImageSourcePropType } from 'react-native'
  const conteudo: ImageSourcePropType
  export default conteudo
}

declare module '*.svg' {
  import type { ImageSourcePropType } from 'react-native'
  const conteudo: ImageSourcePropType
  export default conteudo
}
