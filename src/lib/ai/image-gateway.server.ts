// Server-only module: AI Gateway configuration and image generation helper.
// Never import from client code — it is used by routes under src/routes/api.
import { AI_GATEWAY_BASE_URL } from "./gateway-url";

export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  format: "openai";
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: AI_GATEWAY_BASE_URL,
  model: "openai/gpt-image-2.5-sunburst",
  format: "openai",
};

export function generateImage(
  config: ImageConfig,
  prompt: string,
  stream = true,
  signal?: AbortSignal,
) {
  const input: Record<string, unknown> = stream ? { prompt, partial_images: 1 } : { prompt };
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      ...input,
      ...(stream ? { stream: true } : {}),
    }),
    signal: signal ?? null,
  });
}
