import { describe, it, expect } from "vitest";
import { getSafeRedirect } from "../redirect";

/**
 * Security Regression Tests: Open Redirect Prevention
 *
 * Cada teste representa um vetor de ataque real. Se algum falhar,
 * significa que um atacante consegue redirecionar usuários para domínios externos.
 */

describe("[SEC] Open Redirect Prevention", () => {
  // ── ATAQUES ──────────────────────────────────────────────────────────────

  describe("Ataque: URL absoluta externa", () => {
    it("rejeita https:// externo", () => {
      expect(getSafeRedirect("https://evil.com")).toBe("/dashboard");
    });

    it("rejeita http:// externo", () => {
      expect(getSafeRedirect("http://evil.com/steal-token")).toBe("/dashboard");
    });

    it("rejeita //evil.com (protocol-relative)", () => {
      expect(getSafeRedirect("//evil.com")).toBe("/dashboard");
    });

    it("rejeita //evil.com/path", () => {
      expect(getSafeRedirect("//evil.com/dashboard")).toBe("/dashboard");
    });
  });

  describe("Ataque: Encoding evasion", () => {
    it("rejeita %2F%2Fevil.com (URL-encoded //)", () => {
      expect(getSafeRedirect("%2F%2Fevil.com")).toBe("/dashboard");
    });

    it("rejeita /%2Fevil.com", () => {
      expect(getSafeRedirect("/%2Fevil.com")).toBe("/dashboard");
    });
  });

  describe("Ataque: javascript: protocol", () => {
    it("rejeita javascript:alert(1)", () => {
      expect(getSafeRedirect("javascript:alert(1)")).toBe("/dashboard");
    });

    it("rejeita javascript://evil", () => {
      expect(getSafeRedirect("javascript://evil")).toBe("/dashboard");
    });
  });

  describe("Ataque: Rotas não autorizadas", () => {
    it("rejeita /api/interno", () => {
      expect(getSafeRedirect("/api/interno")).toBe("/dashboard");
    });

    it("rejeita /admin", () => {
      expect(getSafeRedirect("/admin")).toBe("/dashboard");
    });

    it("rejeita /../../etc/passwd (path traversal via redirect)", () => {
      expect(getSafeRedirect("/../../etc/passwd")).toBe("/dashboard");
    });

    it("rejeita string vazia", () => {
      expect(getSafeRedirect("")).toBe("/dashboard");
    });

    it("rejeita null", () => {
      expect(getSafeRedirect(null)).toBe("/dashboard");
    });

    it("rejeita undefined", () => {
      expect(getSafeRedirect(undefined)).toBe("/dashboard");
    });
  });

  // ── ROTAS LEGÍTIMAS ───────────────────────────────────────────────────────

  describe("Rotas legítimas aceitas", () => {
    const validRoutes = [
      "/dashboard",
      "/transacoes",
      "/contas",
      "/cartoes",
      "/relatorios",
      "/orcamentos",
      "/metas",
      "/configuracoes",
      "/transacoes/123",
      "/dashboard?tab=resumo",
    ];

    it.each(validRoutes)("aceita %s", (route) => {
      expect(getSafeRedirect(route)).toBe(route);
    });
  });
});
