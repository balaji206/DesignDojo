import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenAI({ apiKey });

const candidateModels = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-pro'
];

for (const model of candidateModels) {
  const start = Date.now();
  try {
    const res = await genAI.models.generateContent({
      model,
      contents: 'Respond with exactly: OK',
    });
    console.log(`Model ${model}: SUCCESS (${Date.now() - start}ms) -> "${res.text?.trim()}"`);
  } catch (err: any) {
    console.log(`Model ${model}: FAILED (${Date.now() - start}ms) -> ${err.message}`);
  }
}
