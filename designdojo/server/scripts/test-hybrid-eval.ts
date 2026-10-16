import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { AIEvaluator, RuleBasedEvaluator, HybridEvaluator } from '../src/application/Evaluator.js';
import { SEED_PROBLEMS } from '../src/infrastructure/seedData.js';
import { Submission } from '../src/domain/types.js';

const apiKey = process.env.GEMINI_API_KEY!;
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genAI = new GoogleGenAI({ apiKey });

const aiEvaluator = new AIEvaluator(async (prompt, timeoutMs) => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API request timed out')), timeoutMs)
  );
  const responsePromise = genAI.models
    .generateContent({
      model: modelName,
      contents: prompt,
    })
    .then((r) => r.text || '');

  return Promise.race([responsePromise, timeoutPromise]);
}, modelName, 12000);

const ruleEvaluator = new RuleBasedEvaluator();
const hybridEvaluator = new HybridEvaluator(ruleEvaluator, aiEvaluator);

const problem = SEED_PROBLEMS[0]; // parking lot
const submission: Submission = {
  classes: [
    {
      id: 'c1',
      name: 'ParkingLot',
      kind: 'class',
      attributes: [{ id: 'a1', name: 'floors', type: 'List<ParkingFloor>', visibility: '-' }],
      methods: [{ id: 'm1', name: 'parkVehicle', returnType: 'ParkingTicket', visibility: '+', parameters: [{ name: 'v', type: 'Vehicle' }] }],
    },
    {
      id: 'c2',
      name: 'ParkingFloor',
      kind: 'class',
      attributes: [{ id: 'a2', name: 'floorNumber', type: 'int', visibility: '-' }],
      methods: [{ id: 'm2', name: 'findSpot', returnType: 'ParkingSpot', visibility: '+', parameters: [{ name: 'v', type: 'Vehicle' }] }],
    },
    {
      id: 'c3',
      name: 'ParkingSpot',
      kind: 'class',
      attributes: [{ id: 'a3', name: 'isOccupied', type: 'boolean', visibility: '-' }],
      methods: [{ id: 'm3', name: 'assign', returnType: 'boolean', visibility: '+', parameters: [{ name: 'v', type: 'Vehicle' }] }],
    },
    {
      id: 'c4',
      name: 'Vehicle',
      kind: 'abstract',
      attributes: [{ id: 'a4', name: 'licensePlate', type: 'string', visibility: '#' }],
      methods: [{ id: 'm4', name: 'getType', returnType: 'VehicleType', visibility: '+', parameters: [] }],
    },
    {
      id: 'c5',
      name: 'ParkingTicket',
      kind: 'class',
      attributes: [{ id: 'a5', name: 'issuedAt', type: 'Date', visibility: '-' }],
      methods: [],
    },
    {
      id: 'c6',
      name: 'PricingStrategy',
      kind: 'interface',
      attributes: [],
      methods: [{ id: 'm5', name: 'calculateFee', returnType: 'number', visibility: '+', parameters: [{ name: 'ticket', type: 'ParkingTicket' }] }],
    },
  ],
  relationships: [
    { id: 'r1', sourceId: 'c1', targetId: 'c2', type: 'composition', label: 'manages', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
    { id: 'r2', sourceId: 'c2', targetId: 'c3', type: 'composition', label: 'contains', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
    { id: 'r3', sourceId: 'c1', targetId: 'c6', type: 'dependency', label: 'calculates with', sourceMultiplicity: '1', targetMultiplicity: '1' },
  ],
  rationale: 'Clean composition hierarchy for physical structure with Strategy pattern for pricing.',
};

console.log('Evaluating submission with HybridEvaluator (Deterministic + Gemini)...');
const start = Date.now();
try {
  const report = await hybridEvaluator.evaluate(problem, submission);
  console.log(`Evaluation SUCCESS in ${Date.now() - start}ms:`);
  console.log('Total score:', report.totalScore);
  console.log('Strategy used:', report.evaluatorMetadata.strategyUsed);
  console.log('AI Model:', report.evaluatorMetadata.aiModel);
  console.log('Fallback triggered:', report.evaluatorMetadata.fallbackTriggered);
  if (report.evaluatorMetadata.fallbackReason) {
    console.log('Fallback reason:', report.evaluatorMetadata.fallbackReason);
  }
  console.log('Strengths count:', report.strengths.length);
  console.log('Findings count:', report.findings.length);
} catch (err: any) {
  console.error('Hybrid evaluation threw error:', err);
}
