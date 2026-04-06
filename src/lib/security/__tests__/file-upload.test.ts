import { describe, it, expect } from "vitest";
import { validateMagicBytes, validateFileSize, MAX_AVATAR_SIZE_BYTES } from "../file-upload";

/**
 * Security Regression Tests: File Upload Validation
 *
 * Garante que um atacante não consegue fazer upload de arquivos maliciosos
 * disfarçados de imagens (shell upload, polyglot files, etc.)
 */

// Helpers para criar ArrayBuffers com magic bytes específicos
function makeBuffer(bytes: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buf);
  bytes.forEach((b, i) => (view[i] = b));
  return buf;
}

// Assinaturas legítimas
const JPEG_MAGIC  = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const PNG_MAGIC   = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_MAGIC  = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]; // RIFF....
const GIF89_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]; // GIF89a
const GIF87_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]; // GIF87a

// Assinaturas de arquivos maliciosos comuns
const PHP_MAGIC   = [0x3c, 0x3f, 0x70, 0x68, 0x70]; // <?php
const PDF_MAGIC   = [0x25, 0x50, 0x44, 0x46];        // %PDF
const ZIP_MAGIC   = [0x50, 0x4b, 0x03, 0x04];        // PK (ZIP/JAR/DOCX)
const EXE_MAGIC   = [0x4d, 0x5a];                    // MZ (PE executable)
const SH_MAGIC    = [0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e]; // #!/bin
const ELF_MAGIC   = [0x7f, 0x45, 0x4c, 0x46];        // ELF (Linux binary)

describe("[SEC] File Upload - Magic Bytes Validation", () => {
  // ── ATAQUES: MIME CONFUSION ───────────────────────────────────────────────

  describe("Ataque: PHP shell disfarçado de imagem", () => {
    it("rejeita <?php com Content-Type image/jpeg", () => {
      const result = validateMagicBytes(makeBuffer(PHP_MAGIC), "image/jpeg");
      expect(result.valid).toBe(false);
    });

    it("rejeita <?php com Content-Type image/png", () => {
      const result = validateMagicBytes(makeBuffer(PHP_MAGIC), "image/png");
      expect(result.valid).toBe(false);
    });
  });

  describe("Ataque: Executável disfarçado de imagem", () => {
    it("rejeita MZ (Windows EXE) com Content-Type image/jpeg", () => {
      expect(validateMagicBytes(makeBuffer(EXE_MAGIC), "image/jpeg").valid).toBe(false);
    });

    it("rejeita ELF (Linux binary) com Content-Type image/png", () => {
      expect(validateMagicBytes(makeBuffer(ELF_MAGIC), "image/png").valid).toBe(false);
    });

    it("rejeita shell script com Content-Type image/webp", () => {
      expect(validateMagicBytes(makeBuffer(SH_MAGIC), "image/webp").valid).toBe(false);
    });
  });

  describe("Ataque: Polyglot files (ZIP/PDF com MIME de imagem)", () => {
    it("rejeita ZIP com Content-Type image/gif", () => {
      expect(validateMagicBytes(makeBuffer(ZIP_MAGIC), "image/gif").valid).toBe(false);
    });

    it("rejeita PDF com Content-Type image/jpeg", () => {
      expect(validateMagicBytes(makeBuffer(PDF_MAGIC), "image/jpeg").valid).toBe(false);
    });
  });

  describe("Ataque: MIME type não permitido", () => {
    it("rejeita application/javascript mesmo com magic bytes de JS", () => {
      expect(validateMagicBytes(makeBuffer([0x2f, 0x2f]), "application/javascript").valid).toBe(false);
    });

    it("rejeita text/html", () => {
      expect(validateMagicBytes(makeBuffer([0x3c, 0x68, 0x74, 0x6d, 0x6c]), "text/html").valid).toBe(false);
    });

    it("rejeita application/octet-stream", () => {
      expect(validateMagicBytes(makeBuffer(ZIP_MAGIC), "application/octet-stream").valid).toBe(false);
    });
  });

  describe("Ataque: Buffer vazio / corrompido", () => {
    it("rejeita buffer completamente vazio como JPEG", () => {
      expect(validateMagicBytes(makeBuffer([]), "image/jpeg").valid).toBe(false);
    });

    it("rejeita buffer de zeros como PNG", () => {
      expect(validateMagicBytes(makeBuffer([0, 0, 0, 0, 0, 0, 0, 0]), "image/png").valid).toBe(false);
    });
  });

  // ── ARQUIVOS LEGÍTIMOS ────────────────────────────────────────────────────

  describe("Arquivos legítimos aceitos", () => {
    it("aceita JPEG real", () => {
      expect(validateMagicBytes(makeBuffer(JPEG_MAGIC), "image/jpeg").valid).toBe(true);
    });

    it("aceita PNG real", () => {
      expect(validateMagicBytes(makeBuffer(PNG_MAGIC), "image/png").valid).toBe(true);
    });

    it("aceita WebP real (RIFF header)", () => {
      expect(validateMagicBytes(makeBuffer(WEBP_MAGIC), "image/webp").valid).toBe(true);
    });

    it("aceita GIF89a real", () => {
      expect(validateMagicBytes(makeBuffer(GIF89_MAGIC), "image/gif").valid).toBe(true);
    });

    it("aceita GIF87a real", () => {
      expect(validateMagicBytes(makeBuffer(GIF87_MAGIC), "image/gif").valid).toBe(true);
    });
  });
});

describe("[SEC] File Upload - Size Validation", () => {
  describe("Ataque: Upload de arquivo gigante (DoS)", () => {
    it("rejeita arquivo de 6MB", () => {
      expect(validateFileSize(6 * 1024 * 1024).valid).toBe(false);
    });

    it("rejeita arquivo de 100MB", () => {
      expect(validateFileSize(100 * 1024 * 1024).valid).toBe(false);
    });

    it("rejeita exatamente 1 byte acima do limite", () => {
      expect(validateFileSize(MAX_AVATAR_SIZE_BYTES + 1).valid).toBe(false);
    });
  });

  describe("Tamanhos aceitos", () => {
    it("aceita arquivo de 1KB", () => {
      expect(validateFileSize(1024).valid).toBe(true);
    });

    it("aceita arquivo de 4.9MB", () => {
      expect(validateFileSize(4.9 * 1024 * 1024).valid).toBe(true);
    });

    it("aceita exatamente no limite (5MB)", () => {
      expect(validateFileSize(MAX_AVATAR_SIZE_BYTES).valid).toBe(true);
    });
  });
});
