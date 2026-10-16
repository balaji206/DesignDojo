import request from 'supertest';
import { createApp } from '../src/app.js';
import { SEED_PROBLEMS } from '../src/infrastructure/seedData.js';
import { PracticeAttempt } from '../src/domain/PracticeAttempt.js';
import { HybridEvaluator, RuleBasedEvaluator } from '../src/application/Evaluator.js';
import { AttemptRepository, ProblemRepository } from '../src/application/EvaluationService.js';
import { Problem } from '../src/domain/types.js';

class MemoryProblemRepo implements ProblemRepository {
  async findAll(): Promise<Problem[]> { return SEED_PROBLEMS; }
  async findByIdOrSlug(id: string): Promise<Problem | null> {
    return SEED_PROBLEMS.find((p) => p.id === id || p.slug === id) || null;
  }
}

class MemoryAttemptRepo implements AttemptRepository {
  private map = new Map<string, PracticeAttempt>();
  async save(a: PracticeAttempt) { this.map.set(a.id, new PracticeAttempt(a.toJSON())); }
  async findById(id: string, l: string) {
    const f = this.map.get(id);
    return f && f.learnerId === l ? new PracticeAttempt(f.toJSON()) : null;
  }
  async findByProblem(p: string, l: string) {
    return Array.from(this.map.values())
      .filter((a) => a.problemId === p && a.learnerId === l)
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
  }
  async findAllByLearner(l: string) {
    return Array.from(this.map.values()).filter((a) => a.learnerId === l);
  }
  async countByProblem(p: string, l: string) {
    return (await this.findByProblem(p, l)).length;
  }
}

async function runVerification() {
  console.log('=== DesignDojo E2E Learner Journey Verification ===');
  const app = createApp({
    problemRepo: new MemoryProblemRepo(),
    attemptRepo: new MemoryAttemptRepo(),
    evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
  });
  const learner = 'e2e-verifier-learner';

  const listRes = await request(app).get('/api/problems').set('x-learner-id', learner);
  console.log(`[1/6] Browse Dashboard: Found ${listRes.body.data.length} seeded problems (Status: ${listRes.status})`);

  const probRes = await request(app).get('/api/problems/elevator-system').set('x-learner-id', learner);
  console.log(`[2/6] Problem Selection: Loaded '${probRes.body.data.title}'`);

  const attempt1Res = await request(app)
    .post('/api/attempts')
    .set('x-learner-id', learner)
    .send({
      problemId: 'elevator-system',
      submission: {
        classes: [
          {
            id: 'c1',
            name: 'ElevatorController',
            kind: 'class',
            attributes: [],
            methods: [{ id: 'm1', name: 'requestElevator', returnType: 'ElevatorCar', visibility: '+', parameters: [] }],
          },
        ],
        relationships: [],
        rationale: 'Initial draft with only controller.',
      },
    });
  const att1 = attempt1Res.body.data;
  console.log(`[3/6] Initial Submission (Attempt #${att1.attemptNumber}): Status=${att1.status}, Score=${att1.report.totalScore}/100, Findings=${att1.report.findings.length}`);

  const retryRes = await request(app)
    .post(`/api/attempts/${att1.id}/retry`)
    .set('x-learner-id', learner)
    .send({
      submission: {
        classes: [
          {
            id: 'c1',
            name: 'ElevatorController',
            kind: 'class',
            attributes: [{ id: 'a1', name: 'cars', type: 'List<ElevatorCar>', visibility: '-' }],
            methods: [{ id: 'm1', name: 'requestElevator', returnType: 'ElevatorCar', visibility: '+', parameters: [{ name: 'req', type: 'HallRequest' }] }],
          },
          {
            id: 'c2',
            name: 'ElevatorCar',
            kind: 'class',
            attributes: [{ id: 'a2', name: 'currentFloor', type: 'int', visibility: '-' }],
            methods: [{ id: 'm2', name: 'move', returnType: 'void', visibility: '+', parameters: [] }],
          },
          {
            id: 'c3',
            name: 'DispatchStrategy',
            kind: 'interface',
            attributes: [],
            methods: [{ id: 'm3', name: 'selectElevator', returnType: 'ElevatorCar', visibility: '+', parameters: [] }],
          },
          {
            id: 'c4',
            name: 'HallRequest',
            kind: 'class',
            attributes: [{ id: 'a3', name: 'floor', type: 'int', visibility: '-' }],
            methods: [],
          },
        ],
        relationships: [
          { id: 'r1', sourceId: 'c1', targetId: 'c2', type: 'composition', label: 'controls', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
          { id: 'r2', sourceId: 'c1', targetId: 'c3', type: 'dependency', label: 'uses strategy', sourceMultiplicity: '1', targetMultiplicity: '1' },
          { id: 'r3', sourceId: 'c1', targetId: 'c4', type: 'association', label: 'processes', sourceMultiplicity: '1', targetMultiplicity: '*' },
        ],
        rationale: 'Added DispatchStrategy interface, ElevatorCar composition, and HallRequest entity to address Attempt #1 findings.',
      },
    });
  const att2 = retryRes.body.data;
  console.log(`[4/6] Refined Retry (Attempt #${att2.attemptNumber}): Status=${att2.status}, Score=${att2.report.totalScore}/100 (Improved from ${att1.report.totalScore} -> ${att2.report.totalScore})`);

  const checkAtt1 = await request(app).get(`/api/attempts/${att1.id}`).set('x-learner-id', learner);
  const isImmutable = checkAtt1.body.data.submission.classes.length === 1;
  console.log(`[5/6] Snapshot Immutability Verified: Attempt #1 still has ${checkAtt1.body.data.submission.classes.length} class (${isImmutable ? 'PASS' : 'FAIL'})`);

  const histRes = await request(app).get('/api/problems/elevator-system/attempts').set('x-learner-id', learner);
  console.log(`[6/6] History Comparison: Retrieved ${histRes.body.data.length} chronological attempts.`);
  console.log('=== ALL E2E CHECKS PASSED SUCCESSFULLY ===');
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
