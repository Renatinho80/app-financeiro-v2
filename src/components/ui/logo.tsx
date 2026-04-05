import { cn } from "@/lib/utils";

interface LogoProps {
  /** sm = sidebar/compact, md = auth pages, lg = standalone large */
  size?: "sm" | "md" | "lg";
  /** Show slogan "SUAS FINANÇAS, SIMPLIFICADAS." */
  showTagline?: boolean;
  className?: string;
}

/* ── Ícone Finia (hexágono + pulso) ── */
function FiniaIcon({ px }: { px: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width={px} height={px} aria-hidden="true">
      <polygon points="100,20 160,55 160,125 100,160 40,125 40,55" fill="#EEEDFE" stroke="#534AB7" strokeWidth="3" />
      <polygon points="100,36 148,63 148,117 100,144 52,117 52,63" fill="none" stroke="#AFA9EC" strokeWidth="1" strokeDasharray="4,3" />
      <polyline points="55,90 72,90 82,62 92,118 102,68 112,90 145,90" fill="none" stroke="#534AB7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Nome "finia" ── */
function FiniaName({ fontSize }: { fontSize: number }) {
  // "finia" em Space Grotesk 700 com letterSpacing -2 ≈ 3.5× o fontSize
  const w = Math.round(fontSize * 3.5);
  const h = Math.round(fontSize * 1.25);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-label="finia">
      <text
        x={w / 2}
        y={fontSize}
        textAnchor="middle"
        fontFamily="var(--font-space-grotesk), 'Arial Black', sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        letterSpacing="-2"
        fill="currentColor"
      >
        finia
      </text>
    </svg>
  );
}

/* ── Slogan ── */
function FiniaSlogan({ fontSize }: { fontSize: number }) {
  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <span
        style={{
          fontFamily: "var(--font-space-grotesk), Arial, sans-serif",
          fontWeight: 300,
          fontSize: `${fontSize}px`,
          letterSpacing: "0.2em",
          textTransform: "uppercase" as const,
          color: "var(--color-muted-foreground, #888780)",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        Suas finanças, simplificadas.
      </span>
      <div className="flex items-center gap-2 w-full">
        <div className="h-px flex-1" style={{ backgroundColor: "#D3D1C7" }} />
        <div className="w-2 h-2 rotate-45 shrink-0 bg-[#534AB7]" />
        <div className="h-px flex-1" style={{ backgroundColor: "#D3D1C7" }} />
      </div>
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

  /* Com slogan: ícone + nome em linha, slogan abaixo */
  if (showTagline) {
    return (
      <div className={cn("flex flex-col items-center gap-2 text-[#26215C] dark:text-[#EEEDFE]", className)}>
        <div className="flex items-center gap-3">
          <FiniaIcon px={config.iconPx} />
          <FiniaName fontSize={config.nameFontSize} />
        </div>
        <FiniaSlogan fontSize={config.sloganFontSize} />
      </div>
    );
  }

  /* Sem slogan: horizontal compacto (sidebar) */
  return (
    <div className={cn("flex items-center gap-2.5 text-[#26215C] dark:text-[#EEEDFE]", className)}>
      <FiniaIcon px={config.iconPx} />
      <FiniaName fontSize={config.nameFontSize} />
    </div>
  );
}
