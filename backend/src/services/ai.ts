import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const sanitizeQuestions = (raw: any[], limit: number): any[] => {
  const cleaned = raw
    .filter((item) => item && typeof item.question === "string")
    .map((item) => {
      const options = Array.isArray(item.options)
        ? item.options
            .map((opt: any) => String(opt).trim())
            .filter((opt: string) => opt.length > 0)
            .slice(0, 4)
        : [];

      while (options.length < 4) {
        options.push(`Option ${options.length + 1}`);
      }

      const numericCorrect =
        typeof item.correct === "number"
          ? item.correct
          : Number.parseInt(String(item.correct), 10);

      const correct =
        Number.isFinite(numericCorrect) && numericCorrect >= 0 && numericCorrect <= 3
          ? numericCorrect
          : 0;

      return {
        question: item.question.trim(),
        options,
        correct,
      };
    });

  if (cleaned.length === 0) {
    throw new Error("No valid questions returned from model");
  }

  return cleaned.slice(0, Math.max(1, limit));
};

export async function generateQuizQuestions(
  topic: string,
  description: string,
  tags: string[] = [],
  numQuestions: number = 5,
): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  }); // or 'gemini-1.5-pro'

  const tagLine = tags.length ? `Tags: ${tags.join(", ")}.` : "";

  const prompt = `Create ${numQuestions} multiple-choice quiz questions.
Topic: "${topic}"
Description: "${description}"
${tagLine}

Return a JSON array containing exactly ${numQuestions} objects. Each object must have:
- "question": a string with the question text,
- "options": an array of 4 strings (the answer choices),
- "correct": an integer (0-3) indicating the index of the correct option.

Only return the JSON array (no markdown, no extra text).`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No valid JSON array found in response");
      parsed = JSON.parse(jsonMatch[0]);
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    return sanitizeQuestions(parsed, numQuestions);
  } catch (err) {
    console.error("Gemini error:", err);
    throw new Error("Failed to generate quiz questions");
  }
}
