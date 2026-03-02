import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AdContent {
  platform: string;
  headline: string;
  body: string;
  hashtags: string[];
  imagePrompt: string;
}

export async function generateAdsFromUrl(url: string, count: number = 1): Promise<AdContent[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this website and generate ${count} unique social media ad variants.
      URL: ${url}

      The ads should rotate through different angles (e.g., problem/solution, feature highlight, testimonial style, urgency-based).

      For each ad, provide:
      1. Platform name (LinkedIn, Instagram, or Twitter)
      2. A catchy headline
      3. Persuasive body text
      4. Relevant hashtags
      5. A detailed image generation prompt for an AI to create a background visual for this ad.`,
      config: {
        tools: [{ urlContext: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING },
              headline: { type: Type.STRING },
              body: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              imagePrompt: { type: Type.STRING },
            },
            required: ["platform", "headline", "body", "hashtags", "imagePrompt"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (e: any) {
    console.error("[Gemini] Ad generation failed:", e?.message || e);
    throw new Error(`Ad text generation failed: ${e?.message || "Unknown error"}`);
  }
}

export async function generateAdImage(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp-image-generation",
      contents: prompt,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
      }
    }
  } catch (err: any) {
    const status = err?.status || err?.code;
    if (status === 429) {
      console.warn("[Gemini] Image generation quota exceeded (free tier does not support image generation). Using placeholder.");
    } else {
      console.error("[Gemini] Image generation failed:", err?.message || err);
    }
  }

  // Fallback: use a seeded placeholder based on the prompt content
  const seed = encodeURIComponent(prompt.substring(0, 50));
  return `https://picsum.photos/seed/${seed}/800/800`;
}
