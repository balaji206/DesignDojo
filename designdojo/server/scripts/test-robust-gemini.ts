import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenAI({ apiKey });

function normalizeSeverity(val: unknown): 'ERROR' | 'WARNING' | 'INFO' {
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    if (s === 'CRITICAL' || s === 'ERROR' || s === 'FATAL' || s === 'HIGH') return 'ERROR';
    if (s === 'MAJOR' || s === 'WARNING' || s === 'MEDIUM' || s === 'WARN') return 'WARNING';
    if (s === 'INFO' || s === 'MINOR' || s === 'LOW' || s === 'SUGGESTION') return 'INFO';
  }
  return 'WARNING';
}

function normalizeCriterion(val: unknown): any {
  const allowed = [
    'requirementCoverage',
    'responsibilitiesAndCohesion',
    'relationshipsAndCoupling',
    'extensibilityAndAbstractions',
    'behaviourAndRationale',
  ];
  if (typeof val === 'string' && allowed.includes(val)) {
    return val;
  }
  if (typeof val === 'string') {
    const s = val.toLowerCase().replace(/[_-]/g, '');
    if (s.includes('require')) return 'requirementCoverage';
    if (s.includes('cohes') || s.includes('responsi')) return 'responsibilitiesAndCohesion';
    if (s.includes('coupl') || s.includes('relat')) return 'relationshipsAndCoupling';
    if (s.includes('extens') || s.includes('abstr')) return 'extensibilityAndAbstractions';
    if (s.includes('behav') || s.includes('ration')) return 'behaviourAndRationale';
  }
  return 'responsibilitiesAndCohesion';
}

const Schema = z.object({
  criterionAdjustments: z.object({
    requirementCoverage: z.number().default(0),
    responsibilitiesAndCohesion: z.number().default(0),
    relationshipsAndCoupling: z.number().default(0),
    extensibilityAndAbstractions: z.number().default(0),
    behaviourAndRationale: z.number().default(0),
  }),
  strengths: z.array(z.string()).default([]),
  findings: z.array(
    z.preprocess(
      (f: any) => ({
        ...f,
        severity: normalizeSeverity(f?.severity),
        criterion: normalizeCriterion(f?.criterion),
        affectedElementIds: Array.isArray(f?.affectedElementIds) ? f.affectedElementIds : [],
        observation: String(f?.observation || 'Observation'),
        explanation: String(f?.explanation || 'Explanation'),
        recommendation: String(f?.recommendation || 'Recommendation'),
        evidence: String(f?.evidence || 'Evidence'),
      }),
      z.object({
        severity: z.enum(['ERROR', 'WARNING', 'INFO']),
        criterion: z.enum([
          'requirementCoverage',
          'responsibilitiesAndCohesion',
          'relationshipsAndCoupling',
          'extensibilityAndAbstractions',
          'behaviourAndRationale',
        ]),
        affectedElementIds: z.array(z.string()),
        observation: z.string().min(1),
        explanation: z.string().min(1),
        recommendation: z.string().min(1),
        evidence: z.string().min(1),
      })
    )
  ).default([]),
});

const prompt = `You are an expert Low-Level Design (LLD) reviewer.
PROBLEM: Multi-Floor Parking Lot System
DESCRIPTION: Multi-floor parking lot with vehicle entry, tickets, fee calculation.
REQUIREMENTS: Support multiple floors, vehicle entry, tickets, fee calculation.

SUBMITTED DESIGN:
{"classes":[{"id":"c1","name":"ParkingLot","kind":"class","attributes":[],"methods":[]}],"relationships":[],"rationale":"basic"}

Respond with ONLY valid JSON:
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

const res = await genAI.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: prompt,
});

const cleaned = res.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || '';
const parsed = JSON.parse(cleaned);
const validated = Schema.parse(parsed);

console.log('SUCCESS! Parsed and validated with Gemini:');
console.log('Findings count:', validated.findings.length);
console.log('Findings sample:', validated.findings[0]);
