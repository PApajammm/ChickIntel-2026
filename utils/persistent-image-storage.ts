import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";

/**
 * Ensures an image URI is persistently saved via Supabase Storage Bucket ('health-scans'),
 * returning a lightweight public HTTP URL (or a tiny compressed Base64 thumbnail as fallback),
 * consuming zero unnecessary database Disk IO or storage overhead.
 */
export async function ensurePersistentImageUri(
  photoUri: string | null | undefined,
): Promise<string> {
  if (!photoUri || typeof photoUri !== "string" || !photoUri.trim()) {
    return "";
  }

  const trimmedUri = photoUri.trim();

  // If already base64 data URI or HTTP URL, return as is
  if (
    trimmedUri.startsWith("data:") ||
    trimmedUri.startsWith("http://") ||
    trimmedUri.startsWith("https://")
  ) {
    return trimmedUri;
  }

  // 1. Downscale and compress local camera photo (width 400px, 50% quality)
  let manipResult: { uri: string; base64?: string } | null = null;
  try {
    manipResult = await manipulateAsync(
      trimmedUri,
      [{ resize: { width: 400 } }],
      { compress: 0.5, format: SaveFormat.JPEG, base64: true },
    );
  } catch (error) {
    console.warn(
      "[persistent-image-storage] Compression failed, proceeding with original URI:",
      error,
    );
  }

  const targetUri = manipResult?.uri ?? trimmedUri;
  const compressedBase64 = manipResult?.base64;

  // 2. Upload to Supabase Storage bucket ('health-scans') to keep database rows tiny (~50 bytes)
  try {
    const base64Data =
      compressedBase64 ??
      (await FileSystem.readAsStringAsync(targetUri, {
        encoding: FileSystem.EncodingType.Base64,
      }));

    if (base64Data) {
      const filename = `scan_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}.jpg`;
      const filePath = `scans/${filename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("health-scans")
        .upload(filePath, decode(base64Data), {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from("health-scans")
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    }
  } catch (storageError) {
    console.warn(
      "[persistent-image-storage] Supabase storage upload fallback applied:",
      storageError,
    );
  }

  // 3. Fallback: Return tiny compressed Base64 (~30 KB) if storage bucket is unavailable
  if (compressedBase64) {
    return `data:image/jpeg;base64,${compressedBase64}`;
  }

  return targetUri;
}
