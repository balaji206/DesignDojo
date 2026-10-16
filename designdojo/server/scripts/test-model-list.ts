import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenAI({ apiKey });

const candidates = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-preview',
  'gemini-2.5-pro',
  'gemini-flash',
  'gemini-pro',
  'gemini-3.8-flash'
];

for (const model of candidates) {
  const start = Date.now();
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout 4s')), 4000)
    );
    const call = genAI.models.generateContent({
      model,
      contents: 'Say hi',
    });
    const res = await Promise.race([call, timeout]);
    console.log(`[AVAILABLE] ${model}: ${Date.now() - start}ms -> ${res.text?.trim().slice(0, 50)}`);
  } catch (err: any) {
    console.log(`[UNAVAILABLE] ${model}: ${Date.now() - start}ms -> ${err.message?.slice(0, 100)}`);
  }
}
