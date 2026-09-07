import type { ScannedItem } from "./expenses";

/** Phone photos are far larger than the model needs; this keeps uploads quick. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

const GENERIC_FAILURE = "Couldn't read the receipt. Try again.";

async function toScaledJpeg(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be opened. Try a JPEG or PNG photo.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error(GENERIC_FAILURE);
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Re-encoding as JPEG also normalises HEIC and PNG into one accepted type.
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export async function scanReceipt(file: File): Promise<ScannedItem[]> {
  const imageBase64 = await toScaledJpeg(file);

  let response: Response;
  try {
    response = await fetch("/api/parse-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
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
