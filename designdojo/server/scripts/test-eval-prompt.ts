import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { GeminiAIResponseSchema } from '../src/application/Evaluator.js';

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenAI({ apiKey });

const prompt = `You are an expert Low-Level Design (LLD) reviewer.
Evaluate this design.
PROBLEM: Multi-Floor Parking Lot System
DESCRIPTION: Multi-floor parking lot with vehicle entry, tickets, fee calculation.
REQUIREMENTS: Support multiple floors, vehicle entry, tickets, fee calculation.
CONSTRAINTS: Concurrency control.

SUBMITTED DESIGN:
{"classes":[{"id":"c1","name":"ParkingLot","kind":"class","attributes":[],"methods":[]}],"relationships":[],"rationale":"basic"}

Respond with ONLY valid JSON with this exact structure:
{
  "criterionAdjustments": {
    "requirementCoverage": -2,
    "responsibilitiesAndCohesion": -1,
    "relationshipsAndCoupling": 0,
    "extensibilityAndAbstractions": -2,
    "behaviourAndRationale": 0
  },
  "strengths": ["Basic class defined"],
  "findings": [
    {
      "severity": "WARNING",
      "criterion": "requirementCoverage",
      "affectedElementIds": ["c1"],
      "observation": "Missing vehicle and floor entities",
      "explanation": "A parking lot requires floors and spots",
      "recommendation": "Add ParkingFloor and ParkingSpot",
      "evidence": "Only ParkingLot class present"
    }
  ]
}`;

for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
  const start = Date.now();
  console.log(`Evaluating with ${model}...`);
  try {
    const res = await genAI.models.generateContent({
      model,
      contents: prompt,
    });
    console.log(`[SUCCESS] ${model} in ${Date.now() - start}ms:`);
    const cleaned = res.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || '';
    const parsed = JSON.parse(cleaned);
    const validated = GeminiAIResponseSchema.parse(parsed);
    console.log('Validated findings count:', validated.findings.length);
    console.log('Strengths:', validated.strengths);
    break; // success!
  } catch (err: any) {
    console.log(`[FAILED] ${model} in ${Date.now() - start}ms:`, err.message);
  }
}
