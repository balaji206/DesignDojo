import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { SubmissionSchema } from '../src/domain/types.js';
import { createApp } from '../src/app.js';
import { SEED_PROBLEMS } from '../src/infrastructure/seedData.js';
import { PracticeAttempt } from '../src/domain/PracticeAttempt.js';
import { RuleBasedEvaluator, HybridEvaluator } from '../src/application/Evaluator.js';
import { ProblemRepository, AttemptRepository } from '../src/application/EvaluationService.js';
import { Problem } from '../src/domain/types.js';

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

describe('Diagram Persistence & Restoration', () => {
  const backupPath = path.resolve(process.cwd(), '../../DesignDojo_Backup.json');
  let backupData: any = null;

  if (fs.existsSync(backupPath)) {
    backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  }

  it('rejects uncorrected raw parkingLot backup due to missing method return types with 400 VALIDATION_ERROR', async () => {
    expect(backupData).not.toBeNull();
    const rawParking = backupData.parkingLot;

    // Direct schema validation rejects empty returnType
    const parseResult = SubmissionSchema.safeParse(rawParking);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const paths = parseResult.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('classes.0.methods.0.returnType');
      expect(paths).toContain('classes.0.methods.1.returnType');
    }

    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', backupData.learnerId || 'learner-l25yffi')
      .send({
        problemId: 'parking-lot',
        submission: rawParking,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
    const detailPaths = res.body.error.details.map((d: any) => d.path);
    expect(detailPaths).toContain('submission.classes.0.methods.0.returnType');
  });

  it('restores parkingLot draft and validates successfully once learner specifies return types', () => {
    expect(backupData).not.toBeNull();
    const rawParking = JSON.parse(JSON.stringify(backupData.parkingLot));

    // Learner corrects the missing return types (using semantic types and void appropriately)
    rawParking.classes[0].methods[0].returnType = 'void';
    rawParking.classes[0].methods[1].returnType = 'ParkingSpot';
    rawParking.classes[2].methods[0].returnType = 'void';
    rawParking.classes[2].methods[1].returnType = 'ParkingSpot';

    const validated = SubmissionSchema.parse(rawParking);

    // Verify all 4 classes are preserved
    expect(validated.classes).toHaveLength(4);
    const names = validated.classes.map((c) => c.name);
    expect(names).toContain('ParkingLot');
    expect(names).toContain('Vehicle');
    expect(names).toContain('ParkingFloor');
    expect(names).toContain('parking');

    // Verify ParkingLot geometry & properties
    const parkingLotCls = validated.classes.find((c) => c.name === 'ParkingLot')!;
    expect(parkingLotCls.kind).toBe('class');
    expect(parkingLotCls.layout).toBeDefined();
    expect(parkingLotCls.layout?.x).toBe(300);
    expect(parkingLotCls.layout?.y).toBe(100);
    expect(parkingLotCls.layout?.width).toBe(220);
    expect(parkingLotCls.layout?.height).toBe(180);

    // Verify visibility mapping (private -> -)
    expect(parkingLotCls.attributes[0].visibility).toBe('-');
    expect(parkingLotCls.attributes[0].name).toBe('name');

    // Verify corrected return types
    expect(parkingLotCls.methods[0].name).toBe('addFloor');
    expect(parkingLotCls.methods[0].returnType).toBe('void');
    expect(parkingLotCls.methods[1].name).toBe('getSpot');
    expect(parkingLotCls.methods[1].returnType).toBe('ParkingSpot');

    // Verify abstract Vehicle class & protected visibility
    const vehicleCls = validated.classes.find((c) => c.name === 'Vehicle')!;
    expect(vehicleCls.kind).toBe('abstract');
    expect(vehicleCls.attributes[0].visibility).toBe('#');

    // Verify parking interface with boolean returnType
    const parkingIface = validated.classes.find((c) => c.name === 'parking')!;
    expect(parkingIface.kind).toBe('interface');
    expect(parkingIface.methods[0].returnType).toBe('boolean');

    // Verify all 4 relationships preserved with source/target mapped to sourceId/targetId
    expect(validated.relationships).toHaveLength(4);
    for (const rel of validated.relationships) {
      expect(rel.sourceId).toBeTruthy();
      expect(rel.targetId).toBeTruthy();
      expect(rel.type).toBe('association');
    }
  });

  it('restores elevator draft from backup without data loss', () => {
    expect(backupData).not.toBeNull();
    const rawElevator = backupData.elevator;

    const validated = SubmissionSchema.parse(rawElevator);

    expect(validated.classes).toHaveLength(4);
    const names = validated.classes.map((c) => c.name);
    expect(names).toContain('ElevatorController');
    expect(names).toContain('ElevatorCar');
    expect(names).toContain('DispatchStrategy');
    expect(names).toContain('ElevatorState');

    expect(validated.relationships).toHaveLength(3);
    const relTypes = validated.relationships.map((r) => r.type);
    expect(relTypes).toContain('composition');
    expect(relTypes).toContain('association');
  });

  it('submits corrected parkingLot to POST /api/attempts successfully returning 201 with COMPLETED report', async () => {
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const correctedParking = JSON.parse(JSON.stringify(backupData.parkingLot));
    correctedParking.classes[0].methods[0].returnType = 'void';
    correctedParking.classes[0].methods[1].returnType = 'ParkingSpot';
    correctedParking.classes[2].methods[0].returnType = 'void';
    correctedParking.classes[2].methods[1].returnType = 'ParkingSpot';

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', backupData.learnerId || 'learner-l25yffi')
      .send({
        problemId: 'parking-lot',
        submission: correctedParking,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toMatch(/^att_/);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.report).toBeDefined();
    expect(typeof res.body.data.report.totalScore).toBe('number');
  });

  it('submits restored elevator backup to POST /api/attempts without 400 Bad Request', async () => {
    const app = createApp({
      problemRepo: new InMemoryProblemRepo(),
      attemptRepo: new InMemoryAttemptRepo(),
      evaluator: new HybridEvaluator(new RuleBasedEvaluator()),
    });

    const res = await request(app)
      .post('/api/attempts')
      .set('x-learner-id', backupData.learnerId || 'learner-l25yffi')
      .send({
        problemId: 'elevator-system',
        submission: backupData.elevator,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.report.totalScore).toBeGreaterThanOrEqual(70);
  });
});

describe('Client Persistence & Export Utilities', () => {
  const backupPath = path.resolve(process.cwd(), '../../DesignDojo_Backup.json');
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  it('normalizes parkingLot draft and preserves non-class geometry, metadata & rationale', async () => {
    const { normalizeDiagramDraft, exportDiagramToJson, parseDiagramImport, draftToSubmission } =
      await import('../../client/src/utils/diagramPersistence.js');

    const draft = normalizeDiagramDraft(backupData, 'parking-lot');
    expect(draft.classes).toHaveLength(4);
    expect(draft.relationships).toHaveLength(4);

    // Verify all layout geometry preserved
    for (const cls of draft.classes) {
      expect(cls.layout).toBeDefined();
      expect(typeof cls.layout?.x).toBe('number');
      expect(typeof cls.layout?.y).toBe('number');
      expect(typeof cls.layout?.width).toBe('number');
      expect(typeof cls.layout?.height).toBe('number');
    }

    // Verify round-trip export to JSON
    const exportedJson = exportDiagramToJson('parking-lot', draft, 'learner-test');
    expect(exportedJson).toContain('ParkingLot');
    expect(exportedJson).toContain('ParkingFloor');

    // Re-import and ensure equality
    const reimported = parseDiagramImport(exportedJson, 'parking-lot');
    expect(reimported.classes).toHaveLength(4);
    expect(reimported.relationships).toHaveLength(4);

    // Convert to submission and test that uncorrected submission fails validation truthfully
    const sub = draftToSubmission(reimported);
    const uncorrectedResult = SubmissionSchema.safeParse(sub);
    expect(uncorrectedResult.success).toBe(false);

    // After learner fixes return types, submission passes backend validation
    reimported.classes[0].methods[0].returnType = 'void';
    reimported.classes[0].methods[1].returnType = 'ParkingSpot';
    reimported.classes[2].methods[0].returnType = 'void';
    reimported.classes[2].methods[1].returnType = 'ParkingSpot';

    const correctedSub = draftToSubmission(reimported);
    const validated = SubmissionSchema.parse(correctedSub);
    expect(validated.classes).toHaveLength(4);
  });

  it('preserves custom shapes from backup in elevator draft', async () => {
    const { normalizeDiagramDraft, exportDiagramToJson, parseDiagramImport } =
      await import('../../client/src/utils/diagramPersistence.js');

    const draft = normalizeDiagramDraft(backupData, 'elevator-system');
    expect(draft.classes).toHaveLength(4);
    expect(draft.relationships).toHaveLength(3);
    expect(draft.shapes).toHaveLength(1);
    expect(draft.shapes[0].type).toBe('ellipse');
    expect(draft.shapes[0].id).toBe('ellipse-1791979901241');

    const exported = exportDiagramToJson('elevator-system', draft, 'learner-test');
    const imported = parseDiagramImport(exported, 'elevator-system');
    expect(imported.shapes).toHaveLength(1);
    expect(imported.shapes[0].id).toBe('ellipse-1791979901241');
  });

  it('handles intentionally empty diagram drafts without loss or error', async () => {
    const { normalizeDiagramDraft, exportDiagramToJson, parseDiagramImport } =
      await import('../../client/src/utils/diagramPersistence.js');

    const emptyDraft = normalizeDiagramDraft(
      {
        classes: [],
        relationships: [],
        rationale: 'Intentionally empty draft for redesign',
      },
      'vending-machine'
    );

    expect(emptyDraft.classes).toHaveLength(0);
    expect(emptyDraft.relationships).toHaveLength(0);
    expect(emptyDraft.rationale).toBe('Intentionally empty draft for redesign');

    const exported = exportDiagramToJson('vending-machine', emptyDraft, 'learner-test');
    const reimported = parseDiagramImport(exported, 'vending-machine');
    expect(reimported.classes).toHaveLength(0);
    expect(reimported.rationale).toBe('Intentionally empty draft for redesign');
  });
});

