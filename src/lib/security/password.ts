/**
 * Security: Password Strength Validation
 *
 * Regras aplicadas server-side e client-side (via esta lib compartilhada).
 * Extração de configuracoes/page.tsx para ser testável isoladamente.
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["Senha inválida"] };
  }

  if (password.length < 8) {
    errors.push("Mínimo de 8 caracteres");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Pelo menos uma letra maiúscula");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Pelo menos uma letra minúscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Pelo menos um número");
  }

  // Bloqueia senhas triviais conhecidas mesmo que passem nas regras acima
  const TRIVIAL_PASSWORDS = new Set([
    "Password1", "Passw0rd", "Admin123", "Qwerty123",
    "Welcome1", "12345678", "Abcd1234",
  ]);
  if (TRIVIAL_PASSWORDS.has(password)) {
    errors.push("Senha muito comum — escolha uma senha única");
  }

  return { valid: errors.length === 0, errors };
}
