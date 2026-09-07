import { GoogleGenAI } from "@google/genai";

// The key is read server-side and never reaches the browser. Passed
// explicitly: left implicit, a missing key silently falls back to Google's
// application-default credentials and fails with an unrelated error.
let client: GoogleGenAI | null = null;

function geminiClient(apiKey: string): GoogleGenAI {
  if (client === null) client = new GoogleGenAI({ apiKey });
  return client;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Inline image data caps the whole request at 20MB, so stay well under it. */
const MAX_BASE64_LENGTH = 12_000_000;

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          cost: { type: "number" },
          quantity: { type: "integer" },
        },
        required: ["name", "cost", "quantity"],
      },
    },
  },
  required: ["items"],
};

const PROMPT = `You are reading a photo of a shopping receipt. List every line item that was actually purchased.

Rules:
- "cost" is the price of ONE unit, not the line total. If the receipt shows "2 @ 3.49" or a line total of 6.98 for 2 units, report cost 3.49 and quantity 2.
- If no quantity is shown, use quantity 1 and the price as printed.
- Include tax, tip, service charges and delivery fees as their own line items, named plainly ("Tax", "Tip", "Delivery fee"). They are real money someone has to pay.
- Exclude lines that are not charges: subtotal, total, change due, payment method, card digits, loyalty or points balances, store phone numbers.
- If a discount or coupon applies to an item, subtract it from that item's cost rather than listing it separately.
- Expand obviously abbreviated names into readable ones (for example "GRND BF" becomes "Ground beef"). If an abbreviation is not obvious, keep it as printed. Never invent an item you cannot see.
- Report costs as plain numbers with no currency symbol.
- If the image is not a receipt, or is too unreadable to parse, return an empty items array.`;

type ParsedItem = { name: string; cost: number; quantity: number };

function field(source: unknown, ...path: string[]): unknown {
  let value = source;
  for (const key of path) {
    if (typeof value !== "object" || value === null) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Turns a quota rejection into something a person can act on. */
function rateLimitMessage(error: unknown): string | null {
  const status = field(error, "statusCode") ?? field(error, "status");
  if (status !== 429) return null;

  const text = [
    field(error, "message"),
    field(error, "error", "message"),
    field(error, "cause", "message"),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  const seconds = /retry in ([\d.]+)s/i.exec(text);
  return seconds
    ? `Gemini's rate limit is hit. Try again in about ${Math.ceil(Number(seconds[1]))} seconds.`
    : "Gemini's rate limit is hit. Wait a minute and try again.";
}

/** The model follows the schema, but a malformed line shouldn't sink the whole receipt. */
function cleanItems(raw: unknown): ParsedItem[] {
  if (typeof raw !== "object" || raw === null) return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  return items.flatMap((entry): ParsedItem[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { name, cost, quantity } = entry as Record<string, unknown>;
    if (typeof name !== "string" || name.trim() === "") return [];
    if (typeof cost !== "number" || !Number.isFinite(cost)) return [];
    const count = typeof quantity === "number" && Number.isFinite(quantity) ? Math.trunc(quantity) : 1;
    return [{ name: name.trim(), cost, quantity: count > 0 ? count : 1 }];
  });
}

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405 });
    }

    let body: { imageBase64?: unknown; mimeType?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Send a JSON body." }, { status: 400 });
    }

    const { imageBase64, mimeType } = body;
    if (typeof imageBase64 !== "string" || imageBase64 === "") {
      return Response.json({ error: "No image received. Try taking the photo again." }, { status: 400 });
    }
    if (typeof mimeType !== "string" || !ACCEPTED_TYPES.includes(mimeType)) {
      return Response.json(
        { error: "That file type isn't supported. Use a JPEG, PNG or WebP photo." },
        { status: 400 },
      );
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return Response.json(
        { error: "That photo is too large. Try again with a smaller image." },
        { status: 413 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set; receipt scanning cannot run.");
      return Response.json(
        { error: "Receipt scanning isn't configured on this server." },
        { status: 500 },
      );
    }

    let interaction;
    try {
      interaction = await geminiClient(apiKey).interactions.create({
        model: "gemini-3.8-flash",
        input: [
          { type: "text", text: PROMPT },
          { type: "image", data: imageBase64, mime_type: mimeType },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: RECEIPT_SCHEMA,
        },
      },
      // The SDK retries four times by default. On a quota rejection each retry
      // spends another request, so one photo can burn five of them. One photo
      // should cost one request; the person can press the button again.
      { maxRetries: 0 });
    } catch (error) {
      const rateLimited = rateLimitMessage(error);
      if (rateLimited) {
        console.error("Gemini rate limit reached.");
        return Response.json({ error: rateLimited }, { status: 429 });
      }
      console.error("Gemini call failed:", error);
      return Response.json({ error: "Couldn't read the receipt. Try again." }, { status: 502 });
    }

    const output = interaction.output_text;
    if (typeof output !== "string") {
      console.error("Gemini returned no output text.");
      return Response.json({ error: "Couldn't read the receipt. Try again." }, { status: 502 });
    }

    try {
      return Response.json({ items: cleanItems(JSON.parse(output)) });
    } catch {
      console.error("Gemini returned unparseable output:", output);
      return Response.json({ error: "Couldn't read the receipt. Try again." }, { status: 502 });
    }
  },
};
