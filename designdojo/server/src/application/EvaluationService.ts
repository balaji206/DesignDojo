import crypto from 'crypto';
import { PracticeAttempt } from '../domain/PracticeAttempt.js';
import { Problem, Submission, SubmissionSchema } from '../domain/types.js';
import { EvaluationStrategy } from './Evaluator.js';

export interface ProblemRepository {
  findAll(): Promise<Problem[]>;
  findByIdOrSlug(idOrSlug: string): Promise<Problem | null>;
}

export interface AttemptRepository {
  save(attempt: PracticeAttempt): Promise<void>;
  findById(id: string, learnerId: string): Promise<PracticeAttempt | null>;
  findByProblem(problemId: string, learnerId: string): Promise<PracticeAttempt[]>;
  findAllByLearner(learnerId: string): Promise<PracticeAttempt[]>;
  countByProblem(problemId: string, learnerId: string): Promise<number>;
}

export class EvaluationService {
  constructor(
    private readonly problemRepo: ProblemRepository,
    private readonly attemptRepo: AttemptRepository,
    private readonly evaluator: EvaluationStrategy
  ) {}

  async submitAttempt(params: {
    learnerId: string;
    problemId: string;
    submission: Submission;
    basedOnAttemptId?: string;
  }): Promise<PracticeAttempt> {
    const problem = await this.problemRepo.findByIdOrSlug(params.problemId);
    if (!problem) {
      const err: any = new Error(`Problem '${params.problemId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const validatedSubmission = SubmissionSchema.parse(params.submission);
    const previousCount = await this.attemptRepo.countByProblem(problem.id, params.learnerId);

    const attempt = PracticeAttempt.createNew({
      id: `att_${crypto.randomUUID()}`,
      learnerId: params.learnerId,
      problemId: problem.id,
      attemptNumber: previousCount + 1,
      submission: validatedSubmission,
      basedOnAttemptId: params.basedOnAttemptId,
    });

    await this.attemptRepo.save(attempt);

    try {
      attempt.markEvaluating();
      await this.attemptRepo.save(attempt);

      const report = await this.evaluator.evaluate(problem, validatedSubmission);
      attempt.markCompleted(report);
      await this.attemptRepo.save(attempt);
    } catch (err: any) {
      attempt.markFailed(err?.message || 'Evaluation failed unexpectedly');
      await this.attemptRepo.save(attempt);
    }

    return attempt;
  }

  async retryAttempt(params: {
    learnerId: string;
    previousAttemptId: string;
    updatedSubmission?: Submission;
  }): Promise<PracticeAttempt> {
    const existing = await this.attemptRepo.findById(params.previousAttemptId, params.learnerId);
    if (!existing) {
      const err: any = new Error(`Attempt '${params.previousAttemptId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const submissionToUse = params.updatedSubmission ?? existing.submission;
    return this.submitAttempt({
      learnerId: params.learnerId,
      problemId: existing.problemId,
      submission: submissionToUse,
      basedOnAttemptId: existing.id,
    });
  }
}
