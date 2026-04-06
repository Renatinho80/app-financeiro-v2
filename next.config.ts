import type { NextConfig } from "next";

const securityHeaders = [
  // Previne MIME type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Bloqueia clickjacking (iframes)
  { key: "X-Frame-Options", value: "DENY" },
  // Força HTTPS por 2 anos (incluindo subdomínios)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Controla referrer em requests cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desativa APIs sensíveis do browser
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()" },
  // Content Security Policy — bloqueia XSS e injeção de scripts
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Supabase API e realtime
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://letzkovxmaukalhsqrpy.supabase.co`,
      // Scripts: apenas self + inline necessário para Next.js
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Estilos: self + inline (Tailwind/shadcn)
      "style-src 'self' 'unsafe-inline'",
      // Imagens: self + Supabase Storage + data URIs
      "img-src 'self' data: blob: https://*.supabase.co",
      // Fontes
      "font-src 'self' data:",
      // Frames bloqueados
      "frame-src 'none'",
      // Objeto/embed bloqueados
      "object-src 'none'",
      // Base URI restrita ao próprio domínio
      "base-uri 'self'",
      // Form action restrita ao próprio domínio
      "form-action 'self'",
    ].join("; "),
  },
  // Remove X-Powered-By que expõe stack
  { key: "X-Powered-By", value: "" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders.filter((h) => h.value !== ""),
      },
    ];
  },
};

export default nextConfig;
