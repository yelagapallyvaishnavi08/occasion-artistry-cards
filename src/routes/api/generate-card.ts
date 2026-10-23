import { createFileRoute } from "@tanstack/react-router";

import { createResponsesCall } from "@/lib/ai/responses";
import { AI_GATEWAY_BASE_URL, TEXT_MODEL } from "@/lib/ai/gateway-url";

export type CardTextRequest = {
  occasion: string;
  style: string;
  tone: string;
  recipient?: string;
  sender?: string;
  personalNote?: string;
};

export type CardTextResult = {
  headline: string;
  message: string;
  artPrompt: string;
};

const SYSTEM_PROMPT = `You are the copywriter and art director of a boutique greeting-card studio.
Given an occasion, an artwork style, a tone and optional names or a personal note, you craft the
card's text and a brief for artwork that visually matches the same context.

Respond with ONLY a single JSON object — no markdown fence, no commentary — with exactly these keys:
- "headline": string, at most 6 words, celebratory, may address the recipient by name if one is given.
- "message": string, 18 to 45 words, warm and specific to the occasion and any personal note. Never wrap it in quotation marks. Never use the word "greeting card".
- "artPrompt": string, 40 to 70 words describing a greeting-card COVER illustration that matches the occasion, style and tone: main subject, composition, colour palette, medium, lighting and mood. It must not contain any text, letters, words or typography, because the card text is overlaid separately.`;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export const Route = createFileRoute("/api/generate-card")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "The AI writer is not configured yet." }, { status: 500 });
        }

        let body: CardTextRequest;
        try {
          body = (await request.json()) as CardTextRequest;
        } catch {
          return Response.json({ error: "Invalid request body." }, { status: 400 });
        }

        const occasion = asString(body.occasion);
        const style = asString(body.style) ?? "Elegant watercolor";
        const tone = asString(body.tone) ?? "Heartfelt";
        if (!occasion) {
          return Response.json({ error: "An occasion is required." }, { status: 400 });
        }

        const details = [
          `Occasion: ${occasion}`,
          `Artwork style: ${style}`,
          `Tone: ${tone}`,
          body.recipient ? `Recipient's name: ${body.recipient}` : "Recipient's name: not given",
          body.sender ? `Card is signed by: ${body.sender}` : "Signature name: not given",
          body.personalNote ? `Personal note to weave in naturally: ${body.personalNote}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const { result } = createResponsesCall(
            request,
            { baseURL: AI_GATEWAY_BASE_URL, apiKey, model: TEXT_MODEL },
            [{ role: "user", content: `Write the greeting card for this brief:\n\n${details}` }],
            SYSTEM_PROMPT,
          );
          const text = await result.text;
          const parsed = extractJsonObject(text);
          const headline = parsed && asString(parsed["headline"]);
          const message = parsed && asString(parsed["message"]);
          const artPrompt = parsed && asString(parsed["artPrompt"]);
          if (!headline || !message || !artPrompt) {
            return Response.json(
              { error: "The AI response could not be read. Please try again." },
              { status: 502 },
            );
          }
          return Response.json({ headline, message, artPrompt });
        } catch (error) {
          if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
            return new Response(null, { status: 499 });
          }
          const status =
            typeof error === "object" && error && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode) || 502
              : 502;
          const message =
            status === 402 || status === 403
              ? (error instanceof Error && error.message) || "AI credits are needed to keep writing."
              : "The AI writer is unavailable right now. Please try again.";
          return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 502 });
        }
      },
    },
  },
});
