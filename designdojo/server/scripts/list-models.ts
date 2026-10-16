import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenAI({ apiKey });

try {
  const modelsPager = await genAI.models.list();
  console.log('--- Available Models ---');
  for await (const m of modelsPager) {
    if (m.supportedActions?.includes('generateContent') || m.name?.includes('gemini')) {
      console.log(`- ${m.name}`);
    }
  }
} catch (err: any) {
  console.error('List models failed:', err.message);
}
