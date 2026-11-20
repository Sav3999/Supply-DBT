/** Size that fits inside a `max`×`max` box, keeping aspect ratio; never upscales. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number; scaled: boolean } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height, scaled: false };
  const ratio = max / long;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio), scaled: true };
}

/**
 * Browser-only: shrink a photo before upload so phone pictures fit the 5MB limit.
 * Returns the original file when it is already small or the browser can't decode it
 * (the server then reports the usual Thai error).
 */
export async function shrinkImage(file: File, max = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const size = fitWithin(bitmap.width, bitmap.height, max);
  if (!size.scaled && file.size <= 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}
