import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SEED_PROBLEMS } from '../src/infrastructure/seedData.js';
import { PracticeAttempt } from '../src/domain/PracticeAttempt.js';
import { RuleBasedEvaluator, HybridEvaluator } from '../src/application/Evaluator.js';
import { ProblemRepository, AttemptRepository } from '../src/application/EvaluationService.js';
import { Problem, Submission } from '../src/domain/types.js';
import { InMemoryUserRepository } from '../src/infrastructure/repositories.js';
import { createJwtToken } from '../src/infrastructure/auth.js';

class MockProblemRepo implements ProblemRepository {
  async findAll(): Promise<Problem[]> {
    return SEED_PROBLEMS;
  }
  async findByIdOrSlug(idOrSlug: string): Promise<Problem | null> {
    return SEED_PROBLEMS.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
  }
}

class MockAttemptRepo implements AttemptRepository {
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
    return Array.from(this.store.values())
      .filter((a) => a.learnerId === learnerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async countByProblem(problemId: string, learnerId: string): Promise<number> {
    return Array.from(this.store.values()).filter(
      (a) => a.problemId === problemId && a.learnerId === learnerId
    ).length;
  }
}

describe('User Isolation, Fresh Canvas & Submission Security Suite', () => {
  let app: any;
  let attemptRepo: MockAttemptRepo;
  let userRepo: InMemoryUserRepository;

  const userA = { id: 'usr_user_a', email: 'alice@example.com', name: 'Alice' };
  const userB = { id: 'usr_user_b', email: 'bob@example.com', name: 'Bob' };
  const tokenA = createJwtToken(userA);
  const tokenB = createJwtToken(userB);

  const validSubmissionA: Submission = {
    classes: [
      {
        id: 'cls-a1',
        name: 'ParkingLot',
        kind: 'class',
        attributes: [{ id: 'attr-1', name: 'id', type: 'string', visibility: '-' }],
        methods: [{ id: 'm-1', name: 'park', returnType: 'void', visibility: '+', parameters: [] }],
      },
    ],
    relationships: [],
    rationale: 'Alice design',
  };

  const validSubmissionB: Submission = {
    classes: [
      {
        id: 'cls-b1',
        name: 'ElevatorController',
        kind: 'class',
        attributes: [{ id: 'attr-2', name: 'state', type: 'string', visibility: '-' }],
        methods: [{ id: 'm-2', name: 'move', returnType: 'void', visibility: '+', parameters: [] }],
      },
    ],
    relationships: [],
    rationale: 'Bob design',
  };

  beforeEach(() => {
    attemptRepo = new MockAttemptRepo();
    userRepo = new InMemoryUserRepository();
    const problemRepo = new MockProblemRepo();
    const evaluator = new HybridEvaluator(new RuleBasedEvaluator());

    app = createApp({
      problemRepo,
      attemptRepo,
      evaluator,
      userRepo,
    });
  });

  it('1. User A and User B registration produces isolated accounts', async () => {
    const regA = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new_alice@example.com', password: 'Password123!', name: 'Alice' });
    expect(regA.status).toBe(201);
    expect(regA.body.data.user.email).toBe('new_alice@example.com');
    expect(regA.body.data.token).toBeDefined();

    const regB = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new_bob@example.com', password: 'Password123!', name: 'Bob' });
    expect(regB.status).toBe(201);
    expect(regB.body.data.user.email).toBe('new_bob@example.com');
    expect(regB.body.data.user.id).not.toBe(regA.body.data.user.id);
  });

  it('2. User A submissions are attributed to User A, and User B submissions to User B', async () => {
    const resA = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problemId: 'prob-parking-lot', submission: validSubmissionA });
    expect(resA.status).toBe(201);
    expect(resA.body.data.learnerId).toBe(userA.id);

    const resB = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ problemId: 'prob-parking-lot', submission: validSubmissionB });
    expect(resB.status).toBe(201);
    expect(resB.body.data.learnerId).toBe(userB.id);

    // Verify User A only sees User A's attempts
    const historyA = await request(app)
      .get('/api/problems/prob-parking-lot/attempts')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(historyA.status).toBe(200);
    expect(historyA.body.data).toHaveLength(1);
    expect(historyA.body.data[0].learnerId).toBe(userA.id);

    // Verify User B only sees User B's attempts
    const historyB = await request(app)
      .get('/api/problems/prob-parking-lot/attempts')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(historyB.status).toBe(200);
    expect(historyB.body.data).toHaveLength(1);
    expect(historyB.body.data[0].learnerId).toBe(userB.id);
  });

  it('3. User B cannot retrieve or inspect User A attempt by ID (Anti-Tampering & Horizontal Priv Esc)', async () => {
    const resA = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problemId: 'prob-parking-lot', submission: validSubmissionA });
    const attemptAId = resA.body.data.id;

    // Bob tries to view Alice's attempt by guessing or passing attemptAId
    const bobAccess = await request(app)
      .get(`/api/attempts/${attemptAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(bobAccess.status).toBe(404);
  });

  it('4. User B cannot retry from User A attempt ID', async () => {
    const resA = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problemId: 'prob-parking-lot', submission: validSubmissionA });
    const attemptAId = resA.body.data.id;

    const bobRetry = await request(app)
      .post(`/api/attempts/${attemptAId}/retry`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ submission: validSubmissionB });
    expect(bobRetry.status).toBe(404);
  });

  it('5. Submissions reject missing method return type and missing parameter type', async () => {
    const invalidSubmission = {
      classes: [
        {
          id: 'cls-inv',
          name: 'InvalidClass',
          kind: 'class',
          attributes: [{ id: 'a1', name: 'x', type: 'string', visibility: '-' }],
          methods: [
            {
              id: 'm1',
              name: 'doWork',
              returnType: '', // Missing return type
              visibility: '+',
              parameters: [{ name: 'param1', type: '' }], // Missing param type
            },
          ],
        },
      ],
      relationships: [],
    };

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problemId: 'prob-parking-lot', submission: invalidSubmission });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('6. Empty submissions array is rejected with actionable error without crashing', async () => {
    const emptySub = {
      classes: [],
      relationships: [],
    };

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problemId: 'prob-parking-lot', submission: emptySub });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
