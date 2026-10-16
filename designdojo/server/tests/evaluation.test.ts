import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SEED_PROBLEMS } from '../src/infrastructure/seedData.js';
import { PracticeAttempt, DomainStateError } from '../src/domain/PracticeAttempt.js';
import {
  AIEvaluator,
  HybridEvaluator,
  RuleBasedEvaluator,
  aggregateTotalScore,
} from '../src/application/Evaluator.js';
import { AttemptRepository, ProblemRepository } from '../src/application/EvaluationService.js';
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
    return (await this.findByProblem(problemId, learnerId)).length;
  }
}

const validParkingSubmission: Submission = {
  classes: [
    {
      id: 'cls-lot',
      name: 'ParkingLot',
      kind: 'class',
      attributes: [{ id: 'a1', name: 'floors', type: 'List<ParkingFloor>', visibility: '-' }],
      methods: [{ id: 'm1', name: 'issueTicket', returnType: 'ParkingTicket', visibility: '+', parameters: [] }],
    },
    {
      id: 'cls-floor',
      name: 'ParkingFloor',
      kind: 'class',
      attributes: [{ id: 'a2', name: 'floorNumber', type: 'int', visibility: '-' }],
      methods: [{ id: 'm2', name: 'findAvailableSpot', returnType: 'ParkingSpot', visibility: '+', parameters: [] }],
    },
    {
      id: 'cls-spot',
      name: 'ParkingSpot',
      kind: 'class',
      attributes: [{ id: 'a3', name: 'isOccupied', type: 'boolean', visibility: '-' }],
      methods: [{ id: 'm3', name: 'assignVehicle', returnType: 'void', visibility: '+', parameters: [] }],
    },
    {
      id: 'cls-vehicle',
      name: 'Vehicle',
      kind: 'abstract',
      attributes: [{ id: 'a4', name: 'licensePlate', type: 'string', visibility: '#' }],
      methods: [],
    },
    {
      id: 'cls-ticket',
      name: 'ParkingTicket',
      kind: 'class',
      attributes: [{ id: 'a5', name: 'entryTime', type: 'Date', visibility: '-' }],
      methods: [],
    },
    {
      id: 'cls-pricing',
      name: 'PricingStrategy',
      kind: 'interface',
      attributes: [],
      methods: [{ id: 'm4', name: 'calculateFee', returnType: 'number', visibility: '+', parameters: [] }],
    },
  ],
  relationships: [
    { id: 'r1', sourceId: 'cls-lot', targetId: 'cls-floor', type: 'composition', label: 'contains', sourceMultiplicity: '1', targetMultiplicity: '*' },
    { id: 'r2', sourceId: 'cls-floor', targetId: 'cls-spot', type: 'composition', label: 'has', sourceMultiplicity: '1', targetMultiplicity: '*' },
    { id: 'r3', sourceId: 'cls-spot', targetId: 'cls-vehicle', type: 'association', label: 'parks', sourceMultiplicity: '1', targetMultiplicity: '0..1' },
    { id: 'r4', sourceId: 'cls-lot', targetId: 'cls-pricing', type: 'dependency', label: 'uses', sourceMultiplicity: '1', targetMultiplicity: '1' },
  ],
  rationale: 'Used Strategy pattern for PricingStrategy and Composition for ParkingLot -> ParkingFloor -> ParkingSpot.',
};

describe('DesignDojo Unit & API Integration Suite (13 Required Cases)', () => {
  let problemRepo: InMemoryProblemRepo;
  let attemptRepo: InMemoryAttemptRepo;
  let ruleEvaluator: RuleBasedEvaluator;

  beforeEach(() => {
    problemRepo = new InMemoryProblemRepo();
    attemptRepo = new InMemoryAttemptRepo();
    ruleEvaluator = new RuleBasedEvaluator();
  });

  it('1. evaluates and persists a valid submission with COMPLETED status and high score', async () => {
    const app = createApp({ problemRepo, attemptRepo, evaluator: new HybridEvaluator(ruleEvaluator) });
    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'learner-1')
      .send({ problemId: 'parking-lot', submission: validParkingSubmission });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.report.totalScore).toBeGreaterThanOrEqual(85);
  });

  it('2. rejects submission with missing required fields via Zod validation (400)', async () => {
    const app = createApp({ problemRepo, attemptRepo, evaluator: ruleEvaluator });
    const res = await request(app)
      .post('/api/attempts')
      .send({ problemId: 'parking-lot', submission: { classes: [] } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('3. flags duplicate class IDs and duplicate class names in deterministic evaluation', async () => {
    const dupSubmission: Submission = {
      classes: [
        { id: 'dup-id', name: 'ParkingLot', kind: 'class', attributes: [], methods: [] },
        { id: 'dup-id', name: 'ParkingLot', kind: 'class', attributes: [], methods: [] },
      ],
      relationships: [],
      rationale: 'Testing duplicate identifiers.',
    };
    const report = await ruleEvaluator.evaluate(SEED_PROBLEMS[0], dupSubmission);
    expect(report.findings.some((f) => f.id.startsWith('rule-dup-id'))).toBe(true);
    expect(report.findings.some((f) => f.id.startsWith('rule-dup-name'))).toBe(true);
  });

  it('4. flags relationships referencing nonexistent class IDs', async () => {
    const badRelSubmission: Submission = {
      ...validParkingSubmission,
      relationships: [
        { id: 'r-bad', sourceId: 'cls-lot', targetId: 'ghost-class-999', type: 'association', label: '', sourceMultiplicity: '1', targetMultiplicity: '1' },
      ],
    };
    const report = await ruleEvaluator.evaluate(SEED_PROBLEMS[0], badRelSubmission);
    const danglingFinding = report.findings.find((f) => f.id === 'rule-dangling-rel-r-bad');
    expect(danglingFinding).toBeDefined();
    expect(danglingFinding?.severity).toBe('ERROR');
  });

  it('5. enforces legal state transitions and throws DomainStateError on illegal transitions', () => {
    const attempt = PracticeAttempt.createNew({
      id: 'att-1',
      learnerId: 'l1',
      problemId: 'prob-parking-lot',
      attemptNumber: 1,
      submission: validParkingSubmission,
    });
    expect(() => attempt.markCompleted({} as any)).toThrow(DomainStateError);

    attempt.markEvaluating();
    attempt.markFailed('Fatal error');
    expect(() => attempt.markEvaluating()).toThrow(DomainStateError);
  });

  it('6. clamps criterion scores and bounds total score strictly between 0 and 100', () => {
    expect(
      aggregateTotalScore({
        requirementCoverage: 99,
        responsibilitiesAndCohesion: 50,
        relationshipsAndCoupling: 50,
        extensibilityAndAbstractions: 50,
        behaviourAndRationale: 50,
      })
    ).toBe(100);

    expect(
      aggregateTotalScore({
        requirementCoverage: -20,
        responsibilitiesAndCohesion: -10,
        relationshipsAndCoupling: -5,
        extensibilityAndAbstractions: -5,
        behaviourAndRationale: -5,
      })
    ).toBe(0);
  });

  it('7. gracefully falls back to deterministic report when Gemini returns malformed JSON', async () => {
    const badAi = new AIEvaluator(async () => 'NOT_VALID_JSON{{{');
    const hybrid = new HybridEvaluator(ruleEvaluator, badAi);
    const report = await hybrid.evaluate(SEED_PROBLEMS[0], validParkingSubmission);

    expect(report.evaluatorMetadata.strategyUsed).toBe('RULE_ONLY');
    expect(report.evaluatorMetadata.fallbackTriggered).toBe(true);
    expect(report.totalScore).toBeGreaterThan(0);
  });

  it('8. gracefully falls back when Gemini times out or throws rate-limit error', async () => {
    const timeoutAi = new AIEvaluator(async () => {
      throw new Error('429 Too Many Requests / Timeout');
    });
    const hybrid = new HybridEvaluator(ruleEvaluator, timeoutAi);
    const report = await hybrid.evaluate(SEED_PROBLEMS[0], validParkingSubmission);

    expect(report.evaluatorMetadata.fallbackTriggered).toBe(true);
    expect(report.evaluatorMetadata.fallbackReason).toContain('429');
  });

  it('9. strips fabricated class IDs from AI findings while merging valid AI feedback', async () => {
    const mockAi = new AIEvaluator(async () =>
      JSON.stringify({
        criterionAdjustments: {
          requirementCoverage: 0,
          responsibilitiesAndCohesion: -2,
          relationshipsAndCoupling: 0,
          extensibilityAndAbstractions: 0,
          behaviourAndRationale: 0,
        },
        strengths: ['Clean separation of concerns'],
        findings: [
          {
            severity: 'INFO',
            criterion: 'responsibilitiesAndCohesion',
            affectedElementIds: ['cls-lot', 'fabricated-hallucinated-id'],
            observation: 'ParkingLot handles ticket creation directly.',
            explanation: 'Could delegate to TicketFactory.',
            recommendation: 'Consider a TicketFactory.',
            evidence: 'ParkingLot.issueTicket()',
          },
        ],
      })
    );
    const hybrid = new HybridEvaluator(ruleEvaluator, mockAi);
    const report = await hybrid.evaluate(SEED_PROBLEMS[0], validParkingSubmission);

    expect(report.evaluatorMetadata.strategyUsed).toBe('HYBRID_AI');
    const aiFinding = report.findings.find((f) => f.source === 'AI');
    expect(aiFinding?.affectedElementIds).toEqual(['cls-lot']);
  });

  it('10. preserves the submission with FAILED status when the evaluator throws fatally', async () => {
    const crashingEvaluator = {
      async evaluate(): Promise<any> {
        throw new Error('Unrecoverable evaluator crash');
      },
    };
    const app = createApp({ problemRepo, attemptRepo, evaluator: crashingEvaluator });
    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'learner-crash')
      .send({ problemId: 'parking-lot', submission: validParkingSubmission });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('FAILED');
    expect(res.body.data.failureReason).toContain('Unrecoverable evaluator crash');
    expect(res.body.data.submission.classes.length).toBe(6);
  });

  it('11. creates a new immutable attempt on retry without overwriting the previous submission', async () => {
    const app = createApp({ problemRepo, attemptRepo, evaluator: ruleEvaluator });

    const firstRes = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'learner-retry')
      .send({ problemId: 'parking-lot', submission: validParkingSubmission });

    const firstId = firstRes.body.data.id;

    const modifiedSubmission: Submission = {
      ...validParkingSubmission,
      rationale: 'Updated second attempt rationale with concurrency details.',
    };

    const retryRes = await request(app)
      .post(`/api/attempts/${firstId}/retry`)
      .set('x-learner-id', 'learner-retry')
      .send({ submission: modifiedSubmission });

    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data.attemptNumber).toBe(2);
    expect(retryRes.body.data.basedOnAttemptId).toBe(firstId);

    const checkFirst = await request(app)
      .get(`/api/attempts/${firstId}`)
      .set('x-learner-id', 'learner-retry');

    expect(checkFirst.body.data.submission.rationale).toBe(validParkingSubmission.rationale);
  });

  it('12. isolates attempt history per learner session identifier', async () => {
    const app = createApp({ problemRepo, attemptRepo, evaluator: ruleEvaluator });

    await request(app)
      .post('/api/attempts')
      .set('x-learner-id', 'alice')
      .send({ problemId: 'parking-lot', submission: validParkingSubmission });

    const bobHistory = await request(app)
      .get('/api/problems/parking-lot/attempts')
      .set('x-learner-id', 'bob');

    expect(bobHistory.status).toBe(200);
    expect(bobHistory.body.data).toHaveLength(0);
  });

  it('13. returns structured 404 JSON error for unknown problems or attempts', async () => {
    const app = createApp({ problemRepo, attemptRepo, evaluator: ruleEvaluator });
    const res = await request(app).get('/api/problems/non-existent-problem');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
