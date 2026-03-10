import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateQuizQuestions(
  courseTitle: string,
  courseDescription: string,
  numQuestions: number = 5,
): Promise<any[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // or 'gemini-1.5-pro'

  const prompt = `Generate ${numQuestions} multiple-choice quiz questions for a course titled "${courseTitle}" with the following description: "${courseDescription}". 
  Return a JSON array containing exactly ${numQuestions} objects. Each object must have:
  - "question": a string with the question text,
  - "options": an array of 4 strings (the answer choices),
  - "correct": an integer (0-3) indicating the index of the correct option.
  The questions should test understanding of key concepts from the course. Do not include any other text, only the JSON array.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from the response (Gemini might wrap in markdown)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No valid JSON array found in response");

    const questions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(questions)) throw new Error("Response is not an array");

    return questions;
  } catch (err) {
    console.error("Gemini error:", err);
    throw new Error("Failed to generate quiz questions");
  }
}
