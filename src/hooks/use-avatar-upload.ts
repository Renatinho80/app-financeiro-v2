"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, formatFileSize } from "@/lib/utils/image-compression";
import { toast } from "sonner";

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    try {
      setUploading(true);

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Tipo de arquivo inválido", { description: "Por favor, selecione uma imagem." });
        return null;
      }

      // Compress image
      const compressed = await compressImage(file, 400, 0.7);
      const originalSize = formatFileSize(file.size);
      const compressedSize = formatFileSize(compressed.size);

      // Create a File object from the Blob
      const compressedFile = new File([compressed], file.name, { type: "image/jpeg" });

      const supabase = createClient();

      // Generate unique filename with timestamp to avoid caching issues
      const timestamp = Date.now();
      const ext = "jpg";
      const fileName = `${userId}/${timestamp}.${ext}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(fileName, compressedFile, { upsert: true });

      if (error) {
        toast.error("Erro ao enviar imagem", { description: error.message });
        return null;
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const publicUrl = publicData.publicUrl;

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) {
        toast.error("Erro ao atualizar perfil", { description: updateError.message });
        return null;
      }

      setAvatarUrl(publicUrl);
      toast.success("Foto enviada com sucesso!", {
        description: `${originalSize} → ${compressedSize} (comprimida)`,
      });

      return publicUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao processar imagem", { description: message });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadAvatar, uploading, avatarUrl, setAvatarUrl };
}
