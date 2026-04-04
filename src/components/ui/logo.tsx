import { cn } from "@/lib/utils";

interface LogoProps {
  /** sm = sidebar/compact, md = auth pages, lg = standalone large */
  size?: "sm" | "md" | "lg";
  /** Show slogan "CADA REAL NO LUGAR CERTO." */
  showTagline?: boolean;
  className?: string;
}

/* ── Ícone Fluxo (arcos + R$) ── */
function FluxoIcon({ px }: { px: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={px}
      height={px}
      aria-hidden="true"
    >
      {/* Arco superior */}
      <path d="M 40,100 A 60,60 0 0 1 160,100" fill="none" stroke="#1D9E75" strokeWidth="5" strokeLinecap="round" />
      {/* Ponta superior direita */}
      <polyline points="148,76 160,100 136,104" fill="none" stroke="#1D9E75" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Arco inferior */}
      <path d="M 160,120 A 60,60 0 0 1 40,120" fill="none" stroke="#0F6E56" strokeWidth="5" strokeLinecap="round" />
      {/* Ponta inferior esquerda */}
      <polyline points="52,144 40,120 64,116" fill="none" stroke="#0F6E56" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* R$ central */}
      <text x="100" y="118" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="36" fontWeight="700" fill="#1D9E75">R$</text>
    </svg>
  );
}

/* ── Nome "fluxo" ── */
function FluxoNome({ fontSize }: { fontSize: number }) {
  // Largura proporcional ao fontSize: "fluxo" em Outfit 800 tem ~3.3× o fontSize
  const w = Math.round(fontSize * 3.4);
  const h = Math.round(fontSize * 1.25);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-label="fluxo"
    >
      <text
        x={w / 2}
        y={fontSize}
        textAnchor="middle"
        fontFamily="var(--font-outfit), 'Arial Black', sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        letterSpacing="-1"
        fill="#1D9E75"
      >
        fluxo
      </text>
    </svg>
  );
}

/* ── Slogan ── */
function FluxoSlogan({ fontSize }: { fontSize: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] shrink-0" />
      <span
        style={{
          fontFamily: "var(--font-outfit), Arial, sans-serif",
          fontWeight: 300,
          fontSize: `${fontSize}px`,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-muted-foreground, #9ca3af)",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        Cada real no lugar certo.
      </span>
      <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] shrink-0" />
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ── Componente público ── */
export function Logo({ size = "sm", showTagline = false, className }: LogoProps) {
  const config = {
    sm: { iconPx: 34, nameFontSize: 28, sloganFontSize: 9  },
    md: { iconPx: 52, nameFontSize: 42, sloganFontSize: 11 },
    lg: { iconPx: 72, nameFontSize: 58, sloganFontSize: 13 },
  }[size];

  /* Com slogan: empilhado verticalmente (ícone em cima, nome+slogan abaixo) */
  if (showTagline) {
    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        <FluxoIcon px={config.iconPx} />
        <FluxoNome fontSize={config.nameFontSize} />
        <FluxoSlogan fontSize={config.sloganFontSize} />
      </div>
    );
  }

  /* Sem slogan: horizontal compacto (sidebar) */
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <FluxoIcon px={config.iconPx} />
      <FluxoNome fontSize={config.nameFontSize} />
    </div>
  );
}
