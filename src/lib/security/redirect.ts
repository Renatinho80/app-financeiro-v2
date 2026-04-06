/**
 * Security: Safe Redirect
 *
 * Previne Open Redirect — valida que o destino é uma rota interna permitida.
 * Extração do auth/callback/route.ts para ser testável isoladamente.
 */

const ALLOWED_REDIRECT_PREFIXES = [
  "/dashboard",
  "/transacoes",
  "/contas",
  "/cartoes",
  "/relatorios",
  "/orcamentos",
  "/metas",
  "/configuracoes",
] as const;

export function getSafeRedirect(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/dashboard";

  // Bloqueia URLs absolutas, protocol-relative (//evil.com) e javascript:
  const isRelativePath = next.startsWith("/") && !next.startsWith("//");
  if (!isRelativePath) return "/dashboard";

  // Bloqueia tentativas de encode de //: %2F%2F, %2f/
  const decoded = decodeURIComponent(next);
  if (decoded.startsWith("//")) return "/dashboard";

  // Whitelist de prefixos autorizados
  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => next === prefix || next.startsWith(prefix + "/") || next.startsWith(prefix + "?")
  );

  return isAllowed ? next : "/dashboard";
}
