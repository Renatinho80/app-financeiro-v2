import { describe, it, expect } from "vitest";
import { accountSchema } from "../account";
import { transactionSchema } from "../transaction";
import { creditCardSchema } from "../credit-card";
import { categorySchema, tagSchema } from "../category";

/**
 * Security Regression Tests: Input Validation (Zod Schemas)
 *
 * Testa vetores de ataque contra os schemas de validação.
 * Garante que inputs maliciosos não chegam ao banco de dados.
 *
 * Nota: Supabase usa prepared statements (imune a SQL injection),
 * mas estes testes garantem o comportamento correto dos schemas Zod
 * e impedem que payloads absurdamente grandes sobrecarreguem o sistema.
 */

// ── HELPERS ───────────────────────────────────────────────────────────────────

const xssPayloads = [
  "<script>alert(1)</script>",
  "javascript:alert(1)",
  "<img src=x onerror=alert(1)>",
  "'><script>document.location='https://evil.com'</script>",
  "\" onmouseover=\"alert(1)\"",
];

const oversizedString = "A".repeat(10_000);

// ── ACCOUNT SCHEMA ────────────────────────────────────────────────────────────

describe("[SEC] accountSchema", () => {
  const validAccount = {
    name: "Conta Corrente",
    type: "checking" as const,
    balance: 1000,
    color: "#FF5733",
  };

  describe("Ataque: Oversized input (DoS / buffer overflow)", () => {
    it("rejeita name com 10.000 caracteres", () => {
      expect(accountSchema.safeParse({ ...validAccount, name: oversizedString }).success).toBe(false);
    });

    it("rejeita bank com 10.000 caracteres", () => {
      expect(accountSchema.safeParse({ ...validAccount, bank: oversizedString }).success).toBe(false);
    });
  });

  describe("Ataque: Injeção via campo color (não-hex)", () => {
    const maliciousColors = [
      "red; background-image: url(javascript:alert(1))",
      "#' OR 1=1 --",
      "expression(alert(1))",
      "url('javascript:alert(1)')",
      oversizedString,
    ];

    it.each(maliciousColors)("rejeita color malicioso: '%s'", (color) => {
      expect(accountSchema.safeParse({ ...validAccount, color }).success).toBe(false);
    });
  });

  describe("Ataque: Type confusion", () => {
    it("rejeita type inválido 'admin'", () => {
      expect(accountSchema.safeParse({ ...validAccount, type: "admin" }).success).toBe(false);
    });

    it("rejeita balance como string", () => {
      expect(accountSchema.safeParse({ ...validAccount, balance: "1000; DROP TABLE accounts" }).success).toBe(false);
    });

    it("rejeita balance como Infinity", () => {
      expect(accountSchema.safeParse({ ...validAccount, balance: Infinity }).success).toBe(false);
    });

    it("rejeita balance como NaN", () => {
      expect(accountSchema.safeParse({ ...validAccount, balance: NaN }).success).toBe(false);
    });
  });

  describe("Cores hex válidas aceitas", () => {
    const validColors = ["#FF5733", "#abc", "#000000", "#FFF"];
    it.each(validColors)("aceita %s", (color) => {
      expect(accountSchema.safeParse({ ...validAccount, color }).success).toBe(true);
    });
  });
});

// ── TRANSACTION SCHEMA ────────────────────────────────────────────────────────

describe("[SEC] transactionSchema", () => {
  const validTx = {
    type: "expense" as const,
    amount: 100,
    description: "Almoço",
    date: "2026-04-06",
    status: "confirmed" as const,
  };

  describe("Ataque: Oversized description (DoS)", () => {
    it("rejeita description com 10.000 caracteres", () => {
      expect(transactionSchema.safeParse({ ...validTx, description: oversizedString }).success).toBe(false);
    });

    it("rejeita notes com 10.000 caracteres", () => {
      expect(transactionSchema.safeParse({ ...validTx, notes: oversizedString }).success).toBe(false);
    });
  });

  describe("Ataque: Manipulação de valor financeiro", () => {
    it("rejeita amount negativo", () => {
      expect(transactionSchema.safeParse({ ...validTx, amount: -100 }).success).toBe(false);
    });

    it("rejeita amount zero", () => {
      expect(transactionSchema.safeParse({ ...validTx, amount: 0 }).success).toBe(false);
    });

    it("rejeita amount como string", () => {
      expect(transactionSchema.safeParse({ ...validTx, amount: "100; DROP TABLE transactions" }).success).toBe(false);
    });

    it("rejeita amount como NaN", () => {
      expect(transactionSchema.safeParse({ ...validTx, amount: NaN }).success).toBe(false);
    });
  });

  describe("Ataque: Date injection", () => {
    const maliciousDates = [
      "'; DROP TABLE transactions; --",
      "2026-04-06' OR '1'='1",
      "not-a-date",
      "04/06/2026",  // formato errado (deveria ser YYYY-MM-DD)
      "2026/04/06",
      "",
    ];

    it.each(maliciousDates)("rejeita date inválido: '%s'", (date) => {
      expect(transactionSchema.safeParse({ ...validTx, date }).success).toBe(false);
    });
  });

  describe("Ataque: UUID injection em foreign keys", () => {
    const maliciousUUIDs = [
      "'; DROP TABLE accounts; --",
      "' OR '1'='1",
      "not-a-uuid",
      "00000000000000000000000000000000", // sem hífens
    ];

    it.each(maliciousUUIDs)("rejeita account_id inválido: '%s'", (account_id) => {
      expect(transactionSchema.safeParse({ ...validTx, account_id }).success).toBe(false);
    });
  });

  describe("Ataque: Type enum manipulation", () => {
    it("rejeita type 'admin'", () => {
      expect(transactionSchema.safeParse({ ...validTx, type: "admin" }).success).toBe(false);
    });

    it("rejeita status 'approved'", () => {
      expect(transactionSchema.safeParse({ ...validTx, status: "approved" }).success).toBe(false);
    });
  });
});

// ── CREDIT CARD SCHEMA ────────────────────────────────────────────────────────

describe("[SEC] creditCardSchema", () => {
  const validCard = {
    name: "Nubank",
    limit_amount: 5000,
    closing_day: 10,
    due_day: 17,
  };

  describe("Ataque: Manipulação de limite financeiro", () => {
    it("rejeita limit_amount negativo", () => {
      expect(creditCardSchema.safeParse({ ...validCard, limit_amount: -1000 }).success).toBe(false);
    });

    it("rejeita limit_amount zero", () => {
      expect(creditCardSchema.safeParse({ ...validCard, limit_amount: 0 }).success).toBe(false);
    });

    it("rejeita limit_amount absurdo (> 10M)", () => {
      expect(creditCardSchema.safeParse({ ...validCard, limit_amount: 999_999_999 }).success).toBe(false);
    });
  });

  describe("Ataque: closing_day == due_day (inconsistência de negócio)", () => {
    it("rejeita closing_day igual a due_day", () => {
      expect(creditCardSchema.safeParse({ ...validCard, closing_day: 15, due_day: 15 }).success).toBe(false);
    });
  });

  describe("Ataque: Days out of range", () => {
    it("rejeita closing_day = 0", () => {
      expect(creditCardSchema.safeParse({ ...validCard, closing_day: 0 }).success).toBe(false);
    });

    it("rejeita due_day = 32", () => {
      expect(creditCardSchema.safeParse({ ...validCard, due_day: 32 }).success).toBe(false);
    });
  });
});

// ── CATEGORY / TAG SCHEMAS ────────────────────────────────────────────────────

describe("[SEC] categorySchema & tagSchema", () => {
  describe("Ataque: XSS em nome de categoria", () => {
    // Zod string() não rejeita XSS por design — é para o banco fazer sanitização
    // Mas campos com max() limitam payloads grandes
    it("rejeita nome com 10.000 caracteres", () => {
      expect(categorySchema.safeParse({ name: oversizedString, type: "expense" }).success).toBe(false);
    });
  });

  describe("Ataque: color não-hex", () => {
    it("rejeita color 'red' em categoria", () => {
      expect(categorySchema.safeParse({ name: "Comida", type: "expense", color: "red" }).success).toBe(false);
    });

    it("rejeita color 'red' em tag", () => {
      expect(tagSchema.safeParse({ name: "urgente", color: "red" }).success).toBe(false);
    });

    it("rejeita color com payload CSS injection", () => {
      expect(categorySchema.safeParse({
        name: "Comida",
        type: "expense",
        color: "expression(alert(1))"
      }).success).toBe(false);
    });
  });

  describe("Ataque: parent_id inválido (IDOR via UUID forjado)", () => {
    it("rejeita parent_id que não é UUID", () => {
      expect(categorySchema.safeParse({
        name: "Sub",
        type: "expense",
        parent_id: "'; SELECT * FROM profiles; --"
      }).success).toBe(false);
    });
  });
});
