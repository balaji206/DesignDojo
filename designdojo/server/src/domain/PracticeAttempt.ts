import { AttemptStatus, EvaluationReport, Submission } from './types.js';

const LEGAL_TRANSITIONS: Record<AttemptStatus, AttemptStatus[]> = {
  SUBMITTED: ['EVALUATING', 'FAILED'],
  EVALUATING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
};

export class DomainStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainStateError';
  }
}

export interface PracticeAttemptProps {
  id: string;
  learnerId: string;
  problemId: string;
  attemptNumber: number;
  basedOnAttemptId?: string;
  submission: Submission;
  status: AttemptStatus;
  report?: EvaluationReport;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PracticeAttempt {
  private props: PracticeAttemptProps;

  constructor(props: PracticeAttemptProps) {
    this.props = {
      ...props,
      submission: JSON.parse(JSON.stringify(props.submission)),
    };
  }

  static createNew(params: {
    id: string;
    learnerId: string;
    problemId: string;
    attemptNumber: number;
    submission: Submission;
    basedOnAttemptId?: string;
  }): PracticeAttempt {
    const now = new Date();
    return new PracticeAttempt({
      ...params,
      status: 'SUBMITTED',
      createdAt: now,
      updatedAt: now,
    });
  }

  private transitionTo(nextStatus: AttemptStatus): void {
    const allowed = LEGAL_TRANSITIONS[this.props.status];
    if (!allowed.includes(nextStatus)) {
      throw new DomainStateError(
        `Illegal state transition from ${this.props.status} to ${nextStatus}`
      );
    }
    this.props.status = nextStatus;
    this.props.updatedAt = new Date();
  }

  public markEvaluating(): void {
    this.transitionTo('EVALUATING');
  }

  public markCompleted(report: EvaluationReport): void {
    this.transitionTo('COMPLETED');
    this.props.report = report;
  }

  public markFailed(reason: string): void {
    this.transitionTo('FAILED');
    this.props.failureReason = reason;
  }

  public toJSON(): PracticeAttemptProps {
    return { ...this.props };
  }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get submission() { return this.props.submission; }
  get report() { return this.props.report; }
  get failureReason() { return this.props.failureReason; }
  get attemptNumber() { return this.props.attemptNumber; }
  get problemId() { return this.props.problemId; }
  get learnerId() { return this.props.learnerId; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
}

