import type { ScannedItem } from "./expenses";

/** Phone photos are far larger than the model needs; this keeps uploads quick. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/** What Gemini will read directly, whether or not the browser can decode it. */
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Roughly the 12MB the endpoint accepts once base64 inflates the bytes by a third. */
const MAX_RAW_BYTES = 9_000_000;

const GENERIC_FAILURE = "Couldn't read the receipt. Try again.";

/** macOS sometimes hands over a HEIC with an empty type. */
function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return "";
}

function toBase64(bytes: Uint8Array): string {
  // Chunked: spreading a whole photo into String.fromCharCode blows the stack.
  const CHUNK = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/** Returns null when the browser has no decoder for this format. */
async function downscaleToJpeg(file: File): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return null;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

async function prepareUpload(file: File): Promise<{ imageBase64: string; mimeType: string }> {
  const downscaled = await downscaleToJpeg(file);
  if (downscaled !== null) return { imageBase64: downscaled, mimeType: "image/jpeg" };

  // No browser decodes HEIC (Chrome refuses it outright), but Gemini reads it
  // directly, so send the original bytes rather than converting.
  const mimeType = mimeTypeOf(file);
  if (!ACCEPTED_TYPES.includes(mimeType)) {
    throw new Error("That file isn't a photo we can read. Try a JPEG, PNG, WebP or HEIC.");
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new Error("That photo is too large to send. Try one under 9MB.");
  }

  return { imageBase64: toBase64(new Uint8Array(await file.arrayBuffer())), mimeType };
}

export async function scanReceipt(file: File): Promise<ScannedItem[]> {
  const upload = await prepareUpload(file);

  let response: Response;
  try {
    response = await fetch("/api/parse-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upload),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }

  // Plain `vite dev` serves the frontend but not api/, so the call 404s.
  if (response.status === 404) {
    throw new Error("Receipt scanning isn't available on this server. Locally, run vercel dev rather than npm run dev.");
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : GENERIC_FAILURE;
    throw new Error(message);
  }

  const items = (payload as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as ScannedItem[]) : [];
}
