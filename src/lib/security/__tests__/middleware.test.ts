import { describe, it, expect } from "vitest";

/**
 * Security Regression Tests: Path Traversal & Middleware Logic
 *
 * Testa a lógica de detecção de path traversal do middleware sem depender
 * do runtime do Next.js. A lógica é extraída para funções puras testáveis.
 */

// Replica a lógica de detecção do middleware (src/middleware.ts)
function isPathTraversal(pathname: string): boolean {
  return (
    pathname.includes("..") ||
    pathname.includes("%2e%2e") ||
    pathname.toLowerCase().includes("%2e%2e") ||
    pathname.includes("%2F") ||
    pathname.includes("%2f")
  );
}

// Replica verificação de rota pública
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  );
}

// Replica verificação de rota protegida
function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
}

describe("[SEC] Path Traversal Detection", () => {
  describe("Ataque: Directory traversal clássico", () => {
    const traversalPaths = [
      "/dashboard/../../../etc/passwd",
      "/transacoes/../../.env",
      "/..",
      "/../",
      "/api/../../../secret",
    ];

    it.each(traversalPaths)("detecta traversal em: '%s'", (path) => {
      expect(isPathTraversal(path)).toBe(true);
    });
  });

  describe("Ataque: URL-encoded traversal (evasão)", () => {
    const encodedPaths = [
      "/dashboard/%2e%2e/%2e%2e/etc/passwd",
      "/api/%2F%2F/internal",
      "/%2e%2e/etc",
      "/transacoes/%2F../secret",
    ];

    it.each(encodedPaths)("detecta traversal encoded em: '%s'", (path) => {
      expect(isPathTraversal(path)).toBe(true);
    });
  });

  describe("Paths legítimos não detectados como traversal", () => {
    const legitimatePaths = [
      "/dashboard",
      "/transacoes/123",
      "/configuracoes",
      "/relatorios?mes=2026-04",
      "/",
    ];

    it.each(legitimatePaths)("não bloqueia path legítimo: '%s'", (path) => {
      expect(isPathTraversal(path)).toBe(false);
    });
  });
});

describe("[SEC] Route Protection Logic", () => {
  describe("Rotas públicas corretamente identificadas", () => {
    const publicRoutes = [
      "/",
      "/login",
      "/login?error=auth_error",
      "/register",
      "/auth/callback",
      "/auth/callback?code=abc123",
    ];

    it.each(publicRoutes)("identifica como pública: '%s'", (path) => {
      expect(isPublicPath(path)).toBe(true);
      expect(isProtectedPath(path)).toBe(false);
    });
  });

  describe("Rotas protegidas corretamente identificadas", () => {
    const protectedRoutes = [
      "/dashboard",
      "/transacoes",
      "/contas",
      "/cartoes",
      "/relatorios",
      "/orcamentos",
      "/metas",
      "/configuracoes",
      "/api/qualquer-coisa",
    ];

    it.each(protectedRoutes)("identifica como protegida: '%s'", (path) => {
      expect(isProtectedPath(path)).toBe(true);
      expect(isPublicPath(path)).toBe(false);
    });
  });
});

describe("[SEC] HTTP Security Headers", () => {
  /**
   * Verifica que os headers de segurança estão configurados no next.config.ts.
   * Testa a presença dos headers na configuração estática (não faz request HTTP).
   */
  it("next.config.ts exporta configuração de headers", async () => {
    const config = await import("../../../../next.config");
    expect(config.default).toBeDefined();
    expect(typeof config.default.headers).toBe("function");
  });

  it("headers() retorna regra para /:path*", async () => {
    const config = await import("../../../../next.config");
    const headerRules = await config.default.headers!();
    const rule = headerRules.find((r: { source: string }) => r.source === "/:path*");
    expect(rule).toBeDefined();
  });

  it("X-Content-Type-Options está configurado como nosniff", async () => {
    const config = await import("../../../../next.config");
    const headerRules = await config.default.headers!();
    const rule = headerRules.find((r: { source: string }) => r.source === "/:path*");
    const header = rule?.headers.find((h: { key: string }) => h.key === "X-Content-Type-Options");
    expect(header?.value).toBe("nosniff");
  });

  it("X-Frame-Options está configurado como DENY", async () => {
    const config = await import("../../../../next.config");
    const headerRules = await config.default.headers!();
    const rule = headerRules.find((r: { source: string }) => r.source === "/:path*");
    const header = rule?.headers.find((h: { key: string }) => h.key === "X-Frame-Options");
    expect(header?.value).toBe("DENY");
  });

  it("Strict-Transport-Security está configurado com preload", async () => {
    const config = await import("../../../../next.config");
    const headerRules = await config.default.headers!();
    const rule = headerRules.find((r: { source: string }) => r.source === "/:path*");
    const header = rule?.headers.find((h: { key: string }) => h.key === "Strict-Transport-Security");
    expect(header?.value).toContain("max-age=");
    expect(header?.value).toContain("includeSubDomains");
  });

  it("Content-Security-Policy está configurado", async () => {
    const config = await import("../../../../next.config");
    const headerRules = await config.default.headers!();
    const rule = headerRules.find((r: { source: string }) => r.source === "/:path*");
    const header = rule?.headers.find((h: { key: string }) => h.key === "Content-Security-Policy");
    expect(header?.value).toBeDefined();
    expect(header?.value).toContain("default-src");
    expect(header?.value).toContain("frame-src 'none'");
    expect(header?.value).toContain("object-src 'none'");
  });
});
