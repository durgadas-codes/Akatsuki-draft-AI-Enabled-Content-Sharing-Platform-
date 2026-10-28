import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

/**
 * Custom error class for Gemini service errors
 */
export class GeminiServiceError extends Error {
  constructor(message, statusCode = 500, code = "GEMINI_ERROR") {
    super(message);
    this.name = "GeminiServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Service to interact with the Google Gemini API using @google/genai
 * Improves post title, description, and content while preserving original meaning.
 */
export const improvePostContent = async ({ title, description, content }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    throw new GeminiServiceError(
      "Gemini API key is not configured. Please set GEMINI_API_KEY in the environment.",
      503,
      "MISSING_API_KEY"
    );
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  let ai;
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (err) {
    throw new GeminiServiceError(
      `Failed to initialize Google Gen AI SDK: ${err.message}`,
      500,
      "SDK_INIT_ERROR"
    );
  }

  const systemInstruction = `
You are an expert editorial AI assistant for "Akatsuki's Draft", a premier content sharing platform.
Your task is to improve the provided article draft's title, description, and content.
Strict Requirements:
1. Polish grammar, readability, tone, clarity, and narrative structure.
2. Preserve the original core message, facts, technical details, and author's original intent.
3. Enhance engagement and professionalism.
4. Output your response STRICTLY as valid JSON matching this schema:
{
  "improvedTitle": "polished engaging title",
  "improvedDescription": "polished concise summary (max 500 characters)",
  "improvedContent": "polished, well-structured, formatted content",
  "summaryOfChanges": "short summary of enhancements made"
}
Do not include any conversational filler, markdown fences, or text outside the JSON object.
`.trim();

  const userPrompt = `
Here is the original draft to improve:
Title: ${title}
Description: ${description}
Content:
${content}
`.trim();

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        { role: "user", parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const rawText = response?.text;
    if (!rawText || rawText.trim() === "") {
      throw new GeminiServiceError(
        "Gemini API returned an empty response.",
        502,
        "EMPTY_AI_RESPONSE"
      );
    }

    // Clean possible markdown backticks if model wrapped JSON
    let cleanedText = rawText.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\s*/, "").replace(/```$/, "").trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("[Gemini Service] Failed to parse JSON response:", rawText);
      throw new GeminiServiceError(
        "Failed to parse structured response from Gemini AI.",
        502,
        "INVALID_AI_RESPONSE_FORMAT"
      );
    }

    if (!parsed.improvedTitle || !parsed.improvedContent) {
      throw new GeminiServiceError(
        "Gemini response did not contain the required fields (improvedTitle, improvedContent).",
        502,
        "INCOMPLETE_AI_RESPONSE"
      );
    }

    return {
      improvedTitle: parsed.improvedTitle.trim(),
      improvedDescription: (parsed.improvedDescription || description).trim(),
      improvedContent: parsed.improvedContent.trim(),
      summaryOfChanges: parsed.summaryOfChanges || "Content polished for clarity and readability.",
      modelUsed: modelName,
    };
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      throw error;
    }

    const msg = error.message || "";
    console.error("[Gemini Service] API Error:", msg);

    if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("resource exhausted")) {
      throw new GeminiServiceError(
        "Gemini API rate limit or quota exceeded. Please try again shortly.",
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    if (msg.includes("API key not valid") || msg.includes("401") || msg.includes("403")) {
      throw new GeminiServiceError(
        "Invalid Gemini API key or unauthorized access.",
        401,
        "INVALID_API_KEY"
      );
    }

    throw new GeminiServiceError(
      `Gemini AI generation failed: ${msg}`,
      502,
      "AI_SERVICE_ERROR"
    );
  }
};
