import { z } from 'zod';

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
export type CriterionKey =
  | 'requirementCoverage'
  | 'responsibilitiesAndCohesion'
  | 'relationshipsAndCoupling'
  | 'extensibilityAndAbstractions'
  | 'behaviourAndRationale';

function normalizeVisibility(val: unknown): '+' | '-' | '#' {
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'public' || trimmed === '+') return '+';
    if (trimmed === 'private' || trimmed === '-') return '-';
    if (trimmed === 'protected' || trimmed === '#') return '#';
  }
  return '-';
}

export const AttributeSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      return {
        ...val,
        id: val.id ? String(val.id) : `attr-${Math.random().toString(36).substring(2, 9)}`,
        name: typeof val.name === 'string' ? val.name.trim() : '',
        type: typeof val.type === 'string' ? val.type.trim() : '',
        visibility: normalizeVisibility(val.visibility),
      };
    }
    return val;
  },
  z.object({
    id: z.string().min(1, 'Attribute ID is required'),
    name: z.string().min(1, 'Attribute name is required'),
    type: z.string().min(1, 'Attribute type is required'),
    visibility: z.enum(['+', '-', '#']).default('-'),
  })
);

export const ParameterSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      return {
        ...val,
        name: typeof val.name === 'string' ? val.name.trim() : '',
        type: typeof val.type === 'string' ? val.type.trim() : '',
      };
    }
    return val;
  },
  z.object({
    name: z.string().min(1, 'Parameter name is required'),
    type: z.string().min(1, 'Parameter type is required'),
  })
);

export const MethodSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      return {
        ...val,
        id: val.id ? String(val.id) : `mth-${Math.random().toString(36).substring(2, 9)}`,
        name: typeof val.name === 'string' ? val.name.trim() : '',
        returnType: typeof val.returnType === 'string' ? val.returnType.trim() : '',
        visibility: normalizeVisibility(val.visibility ?? '+'),
        parameters: Array.isArray(val.parameters) ? val.parameters : [],
      };
    }
    return val;
  },
  z.object({
    id: z.string().min(1, 'Method ID is required'),
    name: z.string().min(1, 'Method name is required'),
    returnType: z.string().min(1, 'Method return type is required'),
    visibility: z.enum(['+', '-', '#']).default('+'),
    parameters: z.array(ParameterSchema).default([]),
  })
);

export const VisualLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().optional().default(220),
  height: z.number().optional().default(140),
  rotation: z.number().optional().default(0),
});

export const ClassDefinitionSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      let layout = val.layout;
      if (!layout && val.position) {
        layout = {
          x: Number(val.position.x) || 100,
          y: Number(val.position.y) || 100,
          width: Number(val.visual?.width) || 220,
          height: Number(val.visual?.height) || 140,
          rotation: 0,
        };
      }
      return {
        ...val,
        kind: val.kind ?? 'class',
        attributes: Array.isArray(val.attributes) ? val.attributes : [],
        methods: Array.isArray(val.methods) ? val.methods : [],
        layout,
      };
    }
    return val;
  },
  z.object({
    id: z.string().min(1, 'Class ID is required'),
    name: z.string().min(1, 'Class name is required'),
    kind: z.enum(['class', 'interface', 'abstract']).default('class'),
    attributes: z.array(AttributeSchema).default([]),
    methods: z.array(MethodSchema).default([]),
    layout: VisualLayoutSchema.optional(),
  })
);

export const RelationshipSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      return {
        ...val,
        sourceId: val.sourceId || val.source,
        targetId: val.targetId || val.target,
        type: val.type ?? 'association',
        label: val.label ?? '',
        sourceMultiplicity: val.sourceMultiplicity ?? '1',
        targetMultiplicity: val.targetMultiplicity ?? '*',
      };
    }
    return val;
  },
  z.object({
    id: z.string().min(1, 'Relationship ID is required'),
    sourceId: z.string().min(1, 'Source class ID is required'),
    targetId: z.string().min(1, 'Target class ID is required'),
    type: z.enum(['association', 'inheritance', 'composition', 'aggregation', 'dependency']),
    label: z.string().optional().default(''),
    sourceMultiplicity: z.string().optional().default('1'),
    targetMultiplicity: z.string().optional().default('*'),
  })
);

export const SubmissionSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      return {
        classes: Array.isArray(val.classes) ? val.classes : [],
        relationships: Array.isArray(val.relationships) ? val.relationships : [],
        rationale: typeof val.rationale === 'string' ? val.rationale : '',
      };
    }
    return val;
  },
  z.object({
    classes: z.array(ClassDefinitionSchema).min(1, 'At least one class or interface is required'),
    relationships: z.array(RelationshipSchema).default([]),
    rationale: z.string().default(''),
  })
);

export const EvaluationFindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['ERROR', 'WARNING', 'INFO']),
  criterion: z.enum([
    'requirementCoverage',
    'responsibilitiesAndCohesion',
    'relationshipsAndCoupling',
    'extensibilityAndAbstractions',
    'behaviourAndRationale',
  ]),
  affectedElementIds: z.array(z.string()),
  observation: z.string().min(1),
  explanation: z.string().min(1),
  recommendation: z.string().min(1),
  evidence: z.string().min(1),
  source: z.enum(['RULE', 'AI']).default('RULE'),
});

export const CriterionScoresSchema = z.object({
  requirementCoverage: z.number().min(0).max(25),
  responsibilitiesAndCohesion: z.number().min(0).max(20),
  relationshipsAndCoupling: z.number().min(0).max(20),
  extensibilityAndAbstractions: z.number().min(0).max(20),
  behaviourAndRationale: z.number().min(0).max(15),
});

export const EvaluationReportSchema = z.object({
  totalScore: z.number().min(0).max(100),
  criterionScores: CriterionScoresSchema,
  strengths: z.array(z.string()),
  findings: z.array(EvaluationFindingSchema),
  recommendations: z.array(z.string()),
  evaluatorMetadata: z.object({
    strategyUsed: z.enum(['RULE_ONLY', 'HYBRID_AI']),
    aiModel: z.string().optional(),
    fallbackTriggered: z.boolean(),
    fallbackReason: z.string().optional(),
    evaluatedAt: z.string(),
  }),
});

export type ClassDefinition = z.infer<typeof ClassDefinitionSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type Submission = z.infer<typeof SubmissionSchema>;
export type EvaluationFinding = z.infer<typeof EvaluationFindingSchema>;
export type CriterionScores = z.infer<typeof CriterionScoresSchema>;
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;

export interface ProblemRubric {
  expectedConcepts: {
    nameVariants: string[];
    description: string;
    requiredMethods?: string[];
    requiredAttributes?: string[];
  }[];
  requireInterfacesOrAbstract: boolean;
  minimumRelationships: number;
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
  rubric: ProblemRubric;
}
