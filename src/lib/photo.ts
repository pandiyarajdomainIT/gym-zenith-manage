import { supabase } from "@/integrations/supabase/client";

const BUCKET = "member-photos";

// Accepts either a storage path or a legacy full public URL and returns the storage path.
export function extractPhotoPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("http")) return value;
  const marker = `/object/public/${BUCKET}/`;
  const i = value.indexOf(marker);
  if (i >= 0) return value.slice(i + marker.length);
  const marker2 = `/object/${BUCKET}/`;
  const j = value.indexOf(marker2);
  if (j >= 0) return value.slice(j + marker2.length);
  return null;
}

export async function getMemberPhotoSignedUrl(
  value: string | null | undefined,
  expiresInSec = 3600,
): Promise<string | null> {
  const path = extractPhotoPath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}