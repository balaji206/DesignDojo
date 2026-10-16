import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SEED_PROBLEMS } from '../src/infrastructure/seedData.js';
import { PracticeAttempt } from '../src/domain/PracticeAttempt.js';
import { RuleBasedEvaluator, HybridEvaluator, AIEvaluator } from '../src/application/Evaluator.js';
import { ProblemRepository, AttemptRepository } from '../src/application/EvaluationService.js';
import { Problem, Submission } from '../src/domain/types.js';

class InMemoryProblemRepo implements ProblemRepository {
  async findAll(): Promise<Problem[]> {
    return SEED_PROBLEMS;
  }
  async findByIdOrSlug(idOrSlug: string): Promise<Problem | null> {
    return SEED_PROBLEMS.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
  }
}

class InMemoryAttemptRepo implements AttemptRepository {
  public store = new Map<string, PracticeAttempt>();

  async save(attempt: PracticeAttempt): Promise<void> {
    this.store.set(attempt.id, new PracticeAttempt(attempt.toJSON()));
  }
  async findById(id: string, learnerId: string): Promise<PracticeAttempt | null> {
    const found = this.store.get(id);
    return found && found.learnerId === learnerId ? new PracticeAttempt(found.toJSON()) : null;
  }
  async findByProblem(problemId: string, learnerId: string): Promise<PracticeAttempt[]> {
    return Array.from(this.store.values())
      .filter((a) => a.problemId === problemId && a.learnerId === learnerId)
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
  }
  async findAllByLearner(learnerId: string): Promise<PracticeAttempt[]> {
    return Array.from(this.store.values()).filter((a) => a.learnerId === learnerId);
  }
  async countByProblem(problemId: string, learnerId: string): Promise<number> {
    return Array.from(this.store.values()).filter(
      (a) => a.problemId === problemId && a.learnerId === learnerId
    ).length;
  }
}

function createSixClassParkingLotSubmission(): Submission {
  return {
    classes: [
      {
        id: 'cls-lot',
        name: 'ParkingLot',
        kind: 'class',
        attributes: [{ id: 'a1', name: 'floors', type: 'List<ParkingFloor>', visibility: '-' }],
        methods: [
          {
            id: 'm1',
            name: 'issueTicket',
            returnType: 'ParkingTicket',
            visibility: '+',
            parameters: [{ name: 'v', type: 'Vehicle' }],
          },
        ],
        layout: { x: 80, y: 60, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-floor',
        name: 'ParkingFloor',
        kind: 'class',
        attributes: [{ id: 'a2', name: 'floorNumber', type: 'int', visibility: '-' }],
        methods: [
          {
            id: 'm2',
            name: 'findAvailableSpot',
            returnType: 'ParkingSpot',
            visibility: '+',
            parameters: [{ name: 'v', type: 'Vehicle' }],
          },
          {
            id: 'm3',
            name: 'addSpot',
            returnType: 'void',
            visibility: '+',
            parameters: [{ name: 'spot', type: 'ParkingSpot' }],
          },
        ],
        layout: { x: 420, y: 60, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-spot',
        name: 'ParkingSpot',
        kind: 'class',
        attributes: [{ id: 'a3', name: 'isOccupied', type: 'boolean', visibility: '-' }],
        methods: [
          {
            id: 'm4',
            name: 'assignVehicle',
            returnType: 'boolean',
            visibility: '+',
            parameters: [{ name: 'v', type: 'Vehicle' }],
          },
          {
            id: 'm5',
            name: 'removeVehicle',
            returnType: 'void',
            visibility: '+',
            parameters: [],
          },
          {
            id: 'm6',
            name: 'isFree',
            returnType: 'boolean',
            visibility: '+',
            parameters: [],
          },
        ],
        layout: { x: 420, y: 260, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-vehicle',
        name: 'Vehicle',
        kind: 'abstract',
        attributes: [{ id: 'a4', name: 'licensePlate', type: 'string', visibility: '#' }],
        methods: [
          {
            id: 'm7',
            name: 'getType',
            returnType: 'VehicleType',
            visibility: '+',
            parameters: [],
          },
        ],
        layout: { x: 80, y: 260, width: 220, height: 120, rotation: 0 },
      },
      {
        id: 'cls-ticket',
        name: 'ParkingTicket',
        kind: 'class',
        attributes: [{ id: 'a5', name: 'entryTime', type: 'Date', visibility: '-' }],
        methods: [],
        layout: { x: 80, y: 430, width: 220, height: 120, rotation: 0 },
      },
      {
        id: 'cls-pricing',
        name: 'PricingStrategy',
        kind: 'interface',
        attributes: [],
        methods: [
          {
            id: 'm8',
            name: 'calculateFee',
            returnType: 'number',
            visibility: '+',
            parameters: [{ name: 'ticket', type: 'ParkingTicket' }],
          },
        ],
        layout: { x: 420, y: 430, width: 250, height: 120, rotation: 0 },
      },
    ],
    relationships: [
      {
        id: 'r1',
        sourceId: 'cls-lot',
        targetId: 'cls-floor',
        type: 'composition',
        label: 'manages',
        sourceMultiplicity: '1',
        targetMultiplicity: '1..*',
      },
      {
        id: 'r2',
        sourceId: 'cls-floor',
        targetId: 'cls-spot',
        type: 'composition',
        label: 'contains',
        sourceMultiplicity: '1',
        targetMultiplicity: '1..*',
      },
      {
        id: 'r3',
        sourceId: 'cls-spot',
        targetId: 'cls-vehicle',
        type: 'association',
        label: 'occupies',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..1',
      },
      {
        id: 'r4',
        sourceId: 'cls-lot',
        targetId: 'cls-pricing',
        type: 'dependency',
        label: 'delegates fee',
        sourceMultiplicity: '1',
        targetMultiplicity: '1',
      },
    ],
    rationale:
      'Used Composition for physical hierarchy (ParkingLot -> ParkingFloor -> ParkingSpot), abstract Vehicle base class, and PricingStrategy interface to adhere to Open/Closed Principle.',
  };
}

describe('Submission Lifecycle & Payload Validation Regression Suite', () => {
  it('reports missing returnType at classes[1].methods[0] with 400 VALIDATION_ERROR', async () => {
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const invalid = createSixClassParkingLotSubmission();
    invalid.classes[1].methods[0].returnType = ''; // ParkingFloor.findAvailableSpot

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'test-learner-1')
      .send({ problemId: 'parking-lot', submission: invalid });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const details = res.body.error.details.map((d: any) => d.path);
    expect(details).toContain('submission.classes.1.methods.0.returnType');
  });

  it('reports missing returnType at classes[1].methods[1] with 400 VALIDATION_ERROR', async () => {
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const invalid = createSixClassParkingLotSubmission();
    invalid.classes[1].methods[1].returnType = ''; // ParkingFloor.addSpot

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'test-learner-1')
      .send({ problemId: 'parking-lot', submission: invalid });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const details = res.body.error.details.map((d: any) => d.path);
    expect(details).toContain('submission.classes.1.methods.1.returnType');
  });

  it('reports missing returnTypes at classes[2].methods[0, 1, 2] with 400 VALIDATION_ERROR', async () => {
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const invalid = createSixClassParkingLotSubmission();
    invalid.classes[2].methods[0].returnType = ''; // ParkingSpot.assignVehicle
    invalid.classes[2].methods[1].returnType = ''; // ParkingSpot.removeVehicle
    invalid.classes[2].methods[2].returnType = ''; // ParkingSpot.isFree

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'test-learner-1')
      .send({ problemId: 'parking-lot', submission: invalid });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const details = res.body.error.details.map((d: any) => d.path);
    expect(details).toContain('submission.classes.2.methods.0.returnType');
    expect(details).toContain('submission.classes.2.methods.1.returnType');
    expect(details).toContain('submission.classes.2.methods.2.returnType');
  });

  it('reports missing returnType at classes[3].methods[0] with 400 VALIDATION_ERROR', async () => {
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const invalid = createSixClassParkingLotSubmission();
    invalid.classes[3].methods[0].returnType = ''; // Vehicle.getType

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'test-learner-1')
      .send({ problemId: 'parking-lot', submission: invalid });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const details = res.body.error.details.map((d: any) => d.path);
    expect(details).toContain('submission.classes.3.methods.0.returnType');
  });

  it('reports empty parameter type at classes[5].methods[0].parameters[0].type with 400 VALIDATION_ERROR', async () => {
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const invalid = createSixClassParkingLotSubmission();
    invalid.classes[5].methods[0].parameters[0].type = ''; // PricingStrategy.calculateFee parameter ticket

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'test-learner-1')
      .send({ problemId: 'parking-lot', submission: invalid });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const details = res.body.error.details.map((d: any) => d.path);
    expect(details).toContain('submission.classes.5.methods.0.parameters.0.type');
  });

  it('successfully creates attempt, evaluates, and returns 201 with immutable snapshot on valid payload', async () => {
    const attemptRepo = new InMemoryAttemptRepo();
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo,
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const validSubmission = createSixClassParkingLotSubmission();

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'learner-persist-1')
      .send({ problemId: 'parking-lot', submission: validSubmission });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    const attempt = res.body.data;
    expect(attempt.status).toBe('COMPLETED');
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.submission.classes).toHaveLength(6);
    expect(attempt.report).toBeDefined();
    expect(attempt.report.totalScore).toBeGreaterThanOrEqual(70);
    expect(attempt.report.criterionScores.requirementCoverage).toBeGreaterThan(0);
    expect(attempt.report.criterionScores.responsibilitiesAndCohesion).toBeGreaterThan(0);
    expect(attempt.report.criterionScores.relationshipsAndCoupling).toBeGreaterThan(0);
    expect(attempt.report.criterionScores.extensibilityAndAbstractions).toBeGreaterThan(0);
    expect(attempt.report.criterionScores.behaviourAndRationale).toBeGreaterThan(0);
    expect(attempt.report.evaluatorMetadata.strategyUsed).toBe('RULE_ONLY');

    // Immutability test: mutating client-side copy does not alter persisted repository copy
    validSubmission.classes[0].name = 'MUTATED_NAME';
    const persisted = await attemptRepo.findById(attempt.id, 'learner-persist-1');
    expect(persisted?.submission.classes[0].name).toBe('ParkingLot');
  });

  it('persists evaluation report and supports retrieval via GET /api/attempts/:id and /api/problems/:id/attempts', async () => {
    const attemptRepo = new InMemoryAttemptRepo();
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo,
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const validSubmission = createSixClassParkingLotSubmission();

    const createRes = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'learner-query-1')
      .send({ problemId: 'parking-lot', submission: validSubmission });

    const attemptId = createRes.body.data.id;

    // Query single attempt
    const singleRes = await request(app)
      .get(`/api/attempts/${attemptId}`)
      .set('x-learner-id', 'learner-query-1');

    expect(singleRes.status).toBe(200);
    expect(singleRes.body.data.id).toBe(attemptId);
    expect(singleRes.body.data.report.totalScore).toBe(createRes.body.data.report.totalScore);

    // Query problem attempts history
    const historyRes = await request(app)
      .get(`/api/problems/parking-lot/attempts`)
      .set('x-learner-id', 'learner-query-1');

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data).toHaveLength(1);
    expect(historyRes.body.data[0].id).toBe(attemptId);
  });

  it('falls back gracefully to deterministic evaluation when Gemini times out or fails', async () => {
    const timingOutClient = async () => {
      throw new Error('Gemini API request timed out after 15000ms');
    };
    const aiEvaluator = new AIEvaluator(timingOutClient, 'gemini-2.5-flash', 100);
    const hybridEvaluator = new HybridEvaluator(new RuleBasedEvaluator(), aiEvaluator);

    const problem = SEED_PROBLEMS[0];
    const submission = createSixClassParkingLotSubmission();

    const report = await hybridEvaluator.evaluate(problem, submission);

    expect(report).toBeDefined();
    expect(typeof report.totalScore).toBe('number');
    expect(report.evaluatorMetadata.strategyUsed).toBe('RULE_ONLY');
    expect(report.evaluatorMetadata.fallbackTriggered).toBe(true);
    expect(report.evaluatorMetadata.fallbackReason).toContain('timed out');
  });

  it('falls back gracefully when Gemini returns authentication or quota error', async () => {
    const authErrorClient = async () => {
      const err: any = new Error('API_KEY_INVALID');
      err.status = 400;
      throw err;
    };
    const aiEvaluator = new AIEvaluator(authErrorClient, 'gemini-2.5-flash', 100);
    const hybridEvaluator = new HybridEvaluator(new RuleBasedEvaluator(), aiEvaluator);

    const problem = SEED_PROBLEMS[0];
    const submission = createSixClassParkingLotSubmission();

    const report = await hybridEvaluator.evaluate(problem, submission);

    expect(report).toBeDefined();
    expect(typeof report.totalScore).toBe('number');
    expect(report.evaluatorMetadata.strategyUsed).toBe('RULE_ONLY');
    expect(report.evaluatorMetadata.fallbackTriggered).toBe(true);
  });

  it('client-side validateSubmission detects missing return types and empty parameter types with actionable messages', async () => {
    const { validateSubmission } = await import('../../client/src/pages/Workspace.js');

    const invalidClasses: any = [
      {
        id: 'cls-1',
        name: 'ParkingFloor',
        kind: 'class',
        attributes: [],
        methods: [
          {
            id: 'm1',
            name: 'findAvailableSpot',
            returnType: '',
            parameters: [],
          },
        ],
      },
      {
        id: 'cls-2',
        name: 'PricingStrategy',
        kind: 'interface',
        attributes: [],
        methods: [
          {
            id: 'm2',
            name: 'calculateFee',
            returnType: 'number',
            parameters: [{ name: 'ticket', type: '' }],
          },
        ],
      },
    ];

    const result = validateSubmission(invalidClasses, []);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);

    const messages = result.errors.map((e: any) => e.message);
    expect(
      messages.some((m: string) => m.includes('ParkingFloor') && m.includes('findAvailableSpot') && m.includes('return type'))
    ).toBe(true);
    expect(
      messages.some((m: string) => m.includes('PricingStrategy') && m.includes('calculateFee') && m.includes('ticket') && m.includes('type'))
    ).toBe(true);
  });
});
