import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
// O Realtime abre WebSocket no mesmo host do Supabase, mas com esquema wss://
const supabaseWs = supabaseUrl.replace(/^https:/, 'wss:')

// Content-Security-Policy.
// 'unsafe-inline' em script-src é exigido pelo bootstrap do App Router (os
// scripts de hidratação são inline e o projeto não usa nonce). 'unsafe-eval'
// fica só em desenvolvimento — o refresh rápido precisa, a build de produção
// não. O ganho real aqui é frame-ancestors/form-action/base-uri/object-src, que
// fecham clickjacking, sequestro de formulário e injeção de <base>.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Impede que o painel seja carregado dentro de um iframe de terceiro
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Não vaza a URL interna (que carrega mes/ano/apartamento_id) para fora
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // Só tem efeito sob HTTPS; a Vercel serve tudo em HTTPS
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  // Não anuncia a stack para quem está fazendo reconhecimento
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Relatórios e exportações nunca devem ficar em cache de CDN ou proxy:
        // carregam dados financeiros por proprietário.
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        ],
      },
    ]
  },
};

export default nextConfig;
