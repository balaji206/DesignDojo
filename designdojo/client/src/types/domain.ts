export type Visibility = '+' | '-' | '#';
export type ClassKind = 'class' | 'interface' | 'abstract';
export type RelationshipType =
  | 'association'
  | 'inheritance'
  | 'composition'
  | 'aggregation'
  | 'dependency';
export type AttemptStatus = 'SUBMITTED' | 'EVALUATING' | 'COMPLETED' | 'FAILED';
export type FindingSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface Attribute {
  id: string;
  name: string;
  type: string;
  visibility: Visibility;
}

export interface Parameter {
  name: string;
  type: string;
}

export interface Method {
  id: string;
  name: string;
  returnType: string;
  visibility: Visibility;
  parameters: Parameter[];
}

export interface VisualLayout {
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface ClassDefinition {
  id: string;
  name: string;
  kind: ClassKind;
  attributes: Attribute[];
  methods: Method[];
  layout?: VisualLayout;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

export interface Submission {
  classes: ClassDefinition[];
  relationships: Relationship[];
  rationale: string;
}

export interface EvaluationFinding {
  id: string;
  severity: FindingSeverity;
  criterion: string;
  affectedElementIds: string[];
  observation: string;
  explanation: string;
  recommendation: string;
  evidence: string;
  source: 'RULE' | 'AI';
}

export interface EvaluationReport {
  totalScore: number;
  criterionScores: {
    requirementCoverage: number;
    responsibilitiesAndCohesion: number;
    relationshipsAndCoupling: number;
    extensibilityAndAbstractions: number;
    behaviourAndRationale: number;
  };
  strengths: string[];
  findings: EvaluationFinding[];
  recommendations: string[];
  evaluatorMetadata: {
    strategyUsed: 'RULE_ONLY' | 'HYBRID_AI';
    aiModel?: string;
    fallbackTriggered: boolean;
    fallbackReason?: string;
    evaluatedAt: string;
  };
}

export interface PracticeAttempt {
  id: string;
  learnerId: string;
  problemId: string;
  attemptNumber: number;
  basedOnAttemptId?: string;
  submission: Submission;
  status: AttemptStatus;
  report?: EvaluationReport;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];
  description: string;
  functionalRequirements: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  hints: string[];
  learnerStats?: {
    attemptCount: number;
    status: 'NOT_STARTED' | 'ATTEMPTED' | 'COMPLETED';
    latestScore: number | null;
    bestScore: number | null;
    lastAttemptAt: string | null;
  };
}


export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
