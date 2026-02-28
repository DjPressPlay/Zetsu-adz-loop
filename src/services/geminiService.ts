import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AdContent {
  platform: string;
  headline: string;
  body: string;
  hashtags: string[];
  imagePrompt: string;
}

export async function generateAdsFromUrl(url: string, count: number = 1): Promise<AdContent[]> {
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

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
}

export async function generateAdImage(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  return "https://picsum.photos/seed/ads/800/800";
}
