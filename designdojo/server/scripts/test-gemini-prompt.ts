import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { SEED_PROBLEMS } from '../src/infrastructure/seedData.js';
import { GeminiAIResponseSchema } from '../src/application/Evaluator.js';

const apiKey = process.env.GEMINI_API_KEY!;
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genAI = new GoogleGenAI({ apiKey });

const prompt = `You are an expert Low-Level Design (LLD) reviewer.
Multiple LLD solutions are valid. Do NOT penalize a learner merely for choosing a different valid class structure.
Do NOT repeat issues already caught by the deterministic evaluator.

PROBLEM: Multi-Floor Parking Lot System
DESCRIPTION: Design an object-oriented multi-floor Parking Lot system.
REQUIREMENTS: Support multiple floors, vehicle entry, tickets, fee calculation.
CONSTRAINTS: Spot allocation prevents double booking.

SUBMITTED DESIGN:
{"classes":[{"id":"c1","name":"ParkingLot","kind":"class","attributes":[],"methods":[]}],"relationships":[],"rationale":"basic"}

EXISTING DETERMINISTIC FINDINGS:
[]

Respond with ONLY valid JSON matching this schema:
{
  "criterionAdjustments": {
    "requirementCoverage": 0,
    "responsibilitiesAndCohesion": 0,
    "relationshipsAndCoupling": 0,
    "extensibilityAndAbstractions": 0,
    "behaviourAndRationale": 0
  },
  "strengths": ["Clear naming"],
  "findings": []
}`;

console.log('Sending prompt to Gemini...');
const start = Date.now();
try {
  const res = await genAI.models.generateContent({
    model: modelName,
    contents: prompt,
  });
  const duration = Date.now() - start;
  console.log(`Gemini completed in ${duration}ms:`);
  console.log(res.text);

  const cleaned = res.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || '';
  const parsed = JSON.parse(cleaned);
  const validated = GeminiAIResponseSchema.parse(parsed);
  console.log('GeminiAIResponseSchema validated successfully!');
} catch (err: any) {
  console.error(`Failed in ${Date.now() - start}ms:`, err.message);
}
