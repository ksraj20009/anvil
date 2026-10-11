/** Image attachments for vision-capable models. */

export interface AttachedImage {
  id: string;
  name: string;
  mime: string;
  /** base64 payload without the data-URL prefix (what Anthropic wants). */
  data: string;
  /** full data URL (what OpenAI's image_url wants). */
  dataUrl: string;
  size: number;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 4;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Split a data URL into its mime type and base64 payload. */
export function dataUrlToParts(dataUrl: string): { mime: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("Not a base64 data URL.");
  return { mime: m[1], data: m[2] };
}

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Read a File into an AttachedImage. Throws on unsupported type or size. */
export function readImageFile(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    if (!isAcceptedImage(file)) {
      reject(new Error(`Unsupported image type: ${file.type || "unknown"}`));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error(`Image is too large (${formatBytes(file.size)} > ${formatBytes(MAX_IMAGE_BYTES)}).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result);
        const { mime, data } = dataUrlToParts(dataUrl);
        resolve({
          id: Math.random().toString(36).slice(2, 10),
          name: file.name,
          mime,
          data,
          dataUrl,
          size: file.size,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}
