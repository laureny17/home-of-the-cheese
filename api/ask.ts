import { GoogleGenAI } from "@google/genai";

// Reads GEMINI_API_KEY from the environment; the key stays on the server.
const ai = new GoogleGenAI({});

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return new Response("Use POST", { status: 405 });
    }
    const { input } = await request.json();
    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input,
    });
    return Response.json({ text: interaction.output_text });
  },
};
