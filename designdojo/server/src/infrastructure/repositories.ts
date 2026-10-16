import { User, UserRepository } from '../domain/User.js';
import { AttemptRepository, ProblemRepository } from '../application/EvaluationService.js';
import { PracticeAttempt } from '../domain/PracticeAttempt.js';
import { Problem } from '../domain/types.js';
import { AttemptModel, ProblemModel, UserModel } from './models.js';
import { SEED_PROBLEMS } from './seedData.js';

export class MongoProblemRepository implements ProblemRepository {
  async ensureSeeded(): Promise<void> {
    for (const prob of SEED_PROBLEMS) {
      await ProblemModel.updateMany(
        { $or: [{ id: prob.id }, { id: prob.slug }, { slug: prob.slug }] },
        { $set: prob }
      );
      await ProblemModel.updateOne({ id: prob.id }, { $set: prob }, { upsert: true });
    }
  }

  async findAll(): Promise<Problem[]> {
    const docs = await ProblemModel.find({ 'rubric.expectedConcepts': { $exists: true } }).lean();
    if (docs.length > 0) {
      return docs as unknown as Problem[];
    }
    const allDocs = await ProblemModel.find().lean();
    return allDocs as unknown as Problem[];
  }

  async findByIdOrSlug(idOrSlug: string): Promise<Problem | null> {
    const doc = await ProblemModel.findOne({
      $or: [{ id: idOrSlug }, { slug: idOrSlug }],
      'rubric.expectedConcepts': { $exists: true },
    }).lean();
    if (doc) return doc as unknown as Problem;

    const fallbackDoc = await ProblemModel.findOne({
      $or: [{ id: idOrSlug }, { slug: idOrSlug }],
    }).lean();
    return (fallbackDoc as unknown as Problem) || null;
  }
}

export class MongoAttemptRepository implements AttemptRepository {
  async save(attempt: PracticeAttempt): Promise<void> {
    const data = attempt.toJSON();
    await AttemptModel.updateOne({ id: data.id }, { $set: data }, { upsert: true });
  }

  async findById(id: string, learnerId: string): Promise<PracticeAttempt | null> {
    const doc: any = await AttemptModel.findOne({ id, learnerId }).lean();
    if (!doc) return null;
    return new PracticeAttempt({
      id: doc.id,
      learnerId: doc.learnerId,
      problemId: doc.problemId,
      attemptNumber: doc.attemptNumber,
      basedOnAttemptId: doc.basedOnAttemptId,
      submission: doc.submission,
      status: doc.status,
      report: doc.report,
      failureReason: doc.failureReason,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
    });
  }

  async findByProblem(problemId: string, learnerId: string): Promise<PracticeAttempt[]> {
    const docs: any[] = await AttemptModel.find({ problemId, learnerId })
      .sort({ attemptNumber: -1 })
      .lean();
    return docs.map(
      (doc) =>
        new PracticeAttempt({
          id: doc.id,
          learnerId: doc.learnerId,
          problemId: doc.problemId,
          attemptNumber: doc.attemptNumber,
          basedOnAttemptId: doc.basedOnAttemptId,
          submission: doc.submission,
          status: doc.status,
          report: doc.report,
          failureReason: doc.failureReason,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        })
    );
  }

  async findAllByLearner(learnerId: string): Promise<PracticeAttempt[]> {
    const docs: any[] = await AttemptModel.find({ learnerId }).sort({ createdAt: -1 }).lean();
    return docs.map(
      (doc) =>
        new PracticeAttempt({
          id: doc.id,
          learnerId: doc.learnerId,
          problemId: doc.problemId,
          attemptNumber: doc.attemptNumber,
          basedOnAttemptId: doc.basedOnAttemptId,
          submission: doc.submission,
          status: doc.status,
          report: doc.report,
          failureReason: doc.failureReason,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        })
    );
  }

  async countByProblem(problemId: string, learnerId: string): Promise<number> {
    return AttemptModel.countDocuments({ problemId, learnerId });
  }
}

export class InMemoryProblemRepository implements ProblemRepository {
  private problems: Problem[] = [...SEED_PROBLEMS];

  async ensureSeeded(): Promise<void> {
    this.problems = [...SEED_PROBLEMS];
  }

  async findAll(): Promise<Problem[]> {
    return this.problems;
  }

  async findByIdOrSlug(idOrSlug: string): Promise<Problem | null> {
    return this.problems.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
  }
}

export class InMemoryAttemptRepository implements AttemptRepository {
  private store = new Map<string, PracticeAttempt>();

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



export class MongoUserRepository implements UserRepository {
  async create(user: { id: string; email: string; passwordHash: string; name: string }): Promise<User> {
    const doc: any = await UserModel.create({
      id: user.id,
      email: user.email.toLowerCase().trim(),
      passwordHash: user.passwordHash,
      name: user.name,
    });
    return {
      id: doc.id,
      email: doc.email,
      passwordHash: doc.passwordHash,
      name: doc.name,
      createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc: any = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!doc) return null;
    return {
      id: doc.id,
      email: doc.email,
      passwordHash: doc.passwordHash,
      name: doc.name,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  async findById(id: string): Promise<User | null> {
    const doc: any = await UserModel.findOne({ id }).lean();
    if (!doc) return null;
    return {
      id: doc.id,
      email: doc.email,
      passwordHash: doc.passwordHash,
      name: doc.name,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async create(user: { id: string; email: string; passwordHash: string; name: string }): Promise<User> {
    const now = new Date().toISOString();
    const created: User = {
      id: user.id,
      email: user.email.toLowerCase().trim(),
      passwordHash: user.passwordHash,
      name: user.name,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(created.id, created);
    return created;
  }

  async findByEmail(email: string): Promise<User | null> {
    const target = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email === target) return u;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
}
