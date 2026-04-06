/**
 * Security: File Upload Validation
 *
 * Valida arquivos por magic bytes (assinatura binária real),
 * não apenas pelo Content-Type declarado pelo cliente.
 * Extração de use-avatar-upload.ts para ser testável isoladamente.
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Assinaturas de magic bytes por tipo MIME.
 * Cada entrada é um array de sequências possíveis (um arquivo pode ter múltiplas assinaturas válidas).
 */
const MAGIC_SIGNATURES: Record<AllowedImageType, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP
  "image/gif":  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a | GIF89a
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida os primeiros bytes de um arquivo contra as assinaturas conhecidas do tipo MIME declarado.
 * @param headerBytes - Primeiros 8+ bytes do arquivo (ArrayBuffer)
 * @param mimeType    - MIME type declarado pelo cliente
 */
export function validateMagicBytes(
  headerBytes: ArrayBuffer,
  mimeType: string
): FileValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as AllowedImageType)) {
    return { valid: false, error: `Tipo não permitido: ${mimeType}` };
  }

  const bytes = Array.from(new Uint8Array(headerBytes));
  const signatures = MAGIC_SIGNATURES[mimeType as AllowedImageType];

  const hasValidSignature = signatures.some((sig) =>
    sig.every((byte, index) => bytes[index] === byte)
  );

  if (!hasValidSignature) {
    return {
      valid: false,
      error: "Conteúdo do arquivo não corresponde ao tipo declarado",
    };
  }

  return { valid: true };
}

/**
 * Valida tamanho do arquivo.
 */
export function validateFileSize(
  sizeBytes: number,
  maxBytes: number = MAX_AVATAR_SIZE_BYTES
): FileValidationResult {
  if (sizeBytes > maxBytes) {
    const maxMB = (maxBytes / 1024 / 1024).toFixed(0);
    return { valid: false, error: `Arquivo excede o limite de ${maxMB}MB` };
  }
  return { valid: true };
}
