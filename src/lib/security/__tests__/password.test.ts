import { describe, it, expect } from "vitest";
import { validatePasswordStrength } from "../password";

/**
 * Security Regression Tests: Password Strength Policy
 *
 * Garante que senhas fracas são sempre rejeitadas.
 * Uma regressão aqui abre o sistema para brute force / credential stuffing.
 */

describe("[SEC] Password Strength Policy", () => {
  // ── SENHAS INVÁLIDAS ──────────────────────────────────────────────────────

  describe("Ataque: Credential Stuffing (senhas comuns)", () => {
    const commonPasswords = [
      "password", "123456", "12345678", "qwerty", "abc123",
      "Password1", "Passw0rd", "Admin123", "Welcome1",
    ];

    it.each(commonPasswords)("rejeita senha comum: '%s'", (pwd) => {
      const result = validatePasswordStrength(pwd);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Ataque: Senha muito curta (brute force)", () => {
    it("rejeita senha de 7 caracteres", () => {
      expect(validatePasswordStrength("Abc123!").valid).toBe(false);
    });

    it("rejeita senha de 1 caractere", () => {
      expect(validatePasswordStrength("A").valid).toBe(false);
    });

    it("rejeita senha vazia", () => {
      expect(validatePasswordStrength("").valid).toBe(false);
    });
  });

  describe("Ataque: Sem complexidade (só minúsculas)", () => {
    it("rejeita senha sem maiúsculas", () => {
      const result = validatePasswordStrength("abcdefg1");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Pelo menos uma letra maiúscula");
    });

    it("rejeita senha sem números", () => {
      const result = validatePasswordStrength("AbcdefGH");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Pelo menos um número");
    });

    it("rejeita senha sem minúsculas", () => {
      const result = validatePasswordStrength("ABCDEFG1");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Pelo menos uma letra minúscula");
    });
  });

  describe("Ataque: Inputs maliciosos", () => {
    it("rejeita null (sem crash)", () => {
      // @ts-expect-error — testa input inválido de runtime
      expect(validatePasswordStrength(null).valid).toBe(false);
    });

    it("rejeita undefined (sem crash)", () => {
      // @ts-expect-error — testa input inválido de runtime
      expect(validatePasswordStrength(undefined).valid).toBe(false);
    });
  });

  // ── SENHAS VÁLIDAS ────────────────────────────────────────────────────────

  describe("Senhas fortes aceitas", () => {
    const validPasswords = [
      "MyStr0ngPass",
      "Finance2024App",
      "C0mpl3xP@ssword",
      "Renato123Finance",
    ];

    it.each(validPasswords)("aceita senha forte: '%s'", (pwd) => {
      expect(validatePasswordStrength(pwd).valid).toBe(true);
    });
  });
});
