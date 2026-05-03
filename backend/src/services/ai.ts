import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const PASSING_SCORE = 70;
export const FOLLOW_UP_THRESHOLD = 90;

export type AdaptiveMode = "remedial" | "follow-up";

export interface QuizSuggestionTrigger {
  latestScore: number;
  averageScore: number;
  attempts: number;
}

export interface TailoredQuizRequest {
  topic: string;
  description: string;
  tags?: string[];
  numQuestions?: number;
  mode?: AdaptiveMode | null;
  trigger?: QuizSuggestionTrigger | null;
  focusPrompts?: string[];
}

export interface CertificateMetadataRequest {
  courseTitle: string;
  courseDescription?: string;
  learnerName?: string;
  educatorName?: string;
}

export interface GeneratedCertificateMetadata {
  name: string;
  description: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

export const clampScore = (score: number) => Math.min(Math.max(score, 0), 100);

export const getAdaptiveMode = (
  latestScore: number,
  averageScore: number,
): AdaptiveMode | null => {
  if (latestScore < PASSING_SCORE) return "remedial";
  if (latestScore < FOLLOW_UP_THRESHOLD || averageScore < FOLLOW_UP_THRESHOLD) {
    return "follow-up";
  }
  return null;
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => String(tag).trim())
    .filter((tag) => tag.length > 0);
};

const sanitizeQuestionCount = (value: unknown, fallback = 5) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 20);
};

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

export async function generateTailoredQuizQuestions({
  topic,
  description,
  tags = [],
  numQuestions = 5,
  mode = null,
  trigger = null,
  focusPrompts = [],
}: TailoredQuizRequest): Promise<any[]> {
  const normalizedTopic = String(topic || "").trim();
  const normalizedDescription = String(description || "").trim();
  const normalizedTags = normalizeTags(tags);

  if (!normalizedTopic || !normalizedDescription) {
    throw new Error("Topic and description are required");
  }

  const targetCount = sanitizeQuestionCount(numQuestions, 5);
  const modeLine = mode
    ? `Generate a ${mode} practice set that targets weak areas while keeping wording clear and concise.`
    : "Generate balanced questions with varied wording and practical framing.";

  const triggerSummary = trigger
    ? `Learner performance summary:
- Latest score: ${clampScore(trigger.latestScore).toFixed(0)}%
- Average score: ${clampScore(trigger.averageScore).toFixed(0)}%
- Attempts: ${Math.max(0, Math.floor(trigger.attempts))}`
    : "";

  const focusLine =
    focusPrompts.length > 0
      ? `Focus especially on these concepts from previous attempts: ${focusPrompts
          .slice(0, 3)
          .join(" | ")}.`
      : "Cover foundational concepts and one applied scenario.";

  const tailoredDescription = [
    normalizedDescription,
    modeLine,
    triggerSummary,
    focusLine,
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n\n");

  return generateQuizQuestions(
    normalizedTopic,
    tailoredDescription,
    normalizedTags,
    targetCount,
  );
}

const sanitizeCertificateMetadata = (
  raw: any,
  fallbackTitle: string,
): GeneratedCertificateMetadata => {
  const name =
    typeof raw?.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : `${fallbackTitle} Completion Certificate`;
  const description =
    typeof raw?.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : `Awarded for successfully completing ${fallbackTitle}.`;

  const attributes = Array.isArray(raw?.attributes)
    ? raw.attributes
        .map((item: any) => ({
          trait_type:
            typeof item?.trait_type === "string" && item.trait_type.trim()
              ? item.trait_type.trim()
              : "",
          value:
            typeof item?.value === "string" && item.value.trim()
              ? item.value.trim()
              : "",
        }))
        .filter(
          (item: { trait_type: string; value: string }) =>
            item.trait_type.length > 0 && item.value.length > 0,
        )
        .slice(0, 12)
    : [];

  return { name, description, attributes };
};

export async function generateCertificateMetadata({
  courseTitle,
  courseDescription = "",
  learnerName = "Learner",
  educatorName = "Educator",
}: CertificateMetadataRequest): Promise<GeneratedCertificateMetadata> {
  const normalizedTitle = String(courseTitle || "").trim();
  if (!normalizedTitle) {
    throw new Error("courseTitle is required");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `Create certificate metadata for a course completion NFT.
Return exactly one JSON object with fields:
- "name" (string)
- "description" (string, concise and celebratory)
- "attributes" (array of objects with "trait_type" and "value", max 8)

Course title: "${normalizedTitle}"
Course description: "${String(courseDescription || "").trim()}"
Learner name: "${String(learnerName || "").trim()}"
Educator name: "${String(educatorName || "").trim()}"

Do not include markdown. Return JSON only.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No valid JSON object found in response");
      parsed = JSON.parse(jsonMatch[0]);
    }

    return sanitizeCertificateMetadata(parsed, normalizedTitle);
  } catch (err) {
    console.error("Certificate metadata generation error:", err);
    throw new Error("Failed to generate certificate metadata");
  }
}
