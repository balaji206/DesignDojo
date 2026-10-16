import { ClassDefinition, ClassKind, Relationship, RelationshipType, Submission, Visibility } from '../types/domain';
import { getLearnerSessionId } from '../api/client';

export interface DiagramShape {
  id: string;
  type: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  style?: Record<string, any>;
  label?: string;
  [key: string]: any;
}

export interface DiagramDraft {
  problemSlug: string;
  learnerId?: string;
  version: number;
  updatedAt: string;
  classes: ClassDefinition[];
  relationships: Relationship[];
  shapes: DiagramShape[];
  shapeEdges: any[];
  rationale: string;
  documentType?: string;
}

export interface DiagramDraftData {
  classes: ClassDefinition[];
  relationships: Relationship[];
  shapes?: DiagramShape[];
  shapeEdges?: any[];
  rationale?: string;
}

export function normalizeVisibility(val: unknown): Visibility {
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'public' || trimmed === '+') return '+';
    if (trimmed === 'private' || trimmed === '-') return '-';
    if (trimmed === 'protected' || trimmed === '#') return '#';
  }
  return '-';
}

export function normalizeDiagramDraft(raw: any, problemSlug?: string): DiagramDraft {
  if (!raw || typeof raw !== 'object') {
    return {
      problemSlug: problemSlug || 'unknown',
      version: 1,
      updatedAt: new Date().toISOString(),
      classes: [],
      relationships: [],
      shapes: [],
      shapeEdges: [],
      rationale: '',
    };
  }

  // Handle multi-problem backup wrappers (e.g. backup with { parkingLot: { ... }, elevator: { ... } })
  let target = raw;
  if (problemSlug) {
    const slugCamel = problemSlug.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
    if (raw[slugCamel]) {
      target = raw[slugCamel];
    } else if (raw[problemSlug]) {
      target = raw[problemSlug];
    } else if (problemSlug.includes('parking') && raw.parkingLot) {
      target = raw.parkingLot;
    } else if (problemSlug.includes('elevator') && raw.elevator) {
      target = raw.elevator;
    }
  }

  const classes: ClassDefinition[] = (Array.isArray(target.classes) ? target.classes : []).map(
    (c: any, idx: number) => {
      // Determine layout from c.layout or legacy c.position & c.visual
      let layout = c.layout;
      if (!layout && (c.position || c.visual)) {
        layout = {
          x: typeof c.position?.x === 'number' ? Math.round(c.position.x) : 120 + (idx % 4) * 50,
          y: typeof c.position?.y === 'number' ? Math.round(c.position.y) : 100 + (idx % 3) * 50,
          width: typeof c.visual?.width === 'number' ? c.visual.width : 220,
          height: typeof c.visual?.height === 'number' ? c.visual.height : 140,
          rotation: 0,
        };
      } else if (!layout) {
        layout = { x: 120 + (idx % 4) * 50, y: 100 + (idx % 3) * 50, width: 220, height: 140, rotation: 0 };
      }

      const kind: ClassKind =
        c.kind === 'interface' || c.kind === 'abstract' ? c.kind : 'class';

      const attributes = (Array.isArray(c.attributes) ? c.attributes : []).map(
        (a: any, aIdx: number) => ({
          id: a.id ? String(a.id) : `attr-${idx}-${aIdx}`,
          name: typeof a.name === 'string' && a.name.trim().length > 0 ? a.name.trim() : `field${aIdx + 1}`,
          type: typeof a.type === 'string' && a.type.trim().length > 0 ? a.type.trim() : 'string',
          visibility: normalizeVisibility(a.visibility),
        })
      );

      const methods = (Array.isArray(c.methods) ? c.methods : []).map((m: any, mIdx: number) => ({
        id: m.id ? String(m.id) : `mth-${idx}-${mIdx}`,
        name: typeof m.name === 'string' && m.name.trim().length > 0 ? m.name.trim() : `method${mIdx + 1}`,
        returnType: typeof m.returnType === 'string' ? m.returnType.trim() : '',
        visibility: normalizeVisibility(m.visibility ?? '+'),
        parameters: (Array.isArray(m.parameters) ? m.parameters : []).map((p: any, pIdx: number) => ({
          name: typeof p.name === 'string' && p.name.trim().length > 0 ? p.name.trim() : `param${pIdx + 1}`,
          type: typeof p.type === 'string' ? p.type.trim() : '',
        })),
      }));

      return {
        id: c.id ? String(c.id) : `cls-${Math.random().toString(36).substring(2, 9)}`,
        name: typeof c.name === 'string' && c.name.trim().length > 0 ? c.name.trim() : `Class${idx + 1}`,
        kind,
        attributes,
        methods,
        layout,
      };
    }
  );

  const relationships: Relationship[] = (
    Array.isArray(target.relationships) ? target.relationships : []
  ).map((r: any, rIdx: number) => {
    const validTypes: RelationshipType[] = [
      'association',
      'inheritance',
      'composition',
      'aggregation',
      'dependency',
    ];
    const type: RelationshipType = validTypes.includes(r.type) ? r.type : 'association';
    return {
      id: r.id ? String(r.id) : `rel-${rIdx + 1}`,
      sourceId: String(r.sourceId || r.source || ''),
      targetId: String(r.targetId || r.target || ''),
      type,
      label: typeof r.label === 'string' ? r.label : '',
      sourceMultiplicity: typeof r.sourceMultiplicity === 'string' ? r.sourceMultiplicity : '1',
      targetMultiplicity: typeof r.targetMultiplicity === 'string' ? r.targetMultiplicity : '*',
    };
  });

  return {
    problemSlug: problemSlug || target.problemSlug || 'unknown',
    learnerId: target.learnerId || raw.learnerId,
    version: typeof target.version === 'number' ? target.version : 1,
    updatedAt: target.updatedAt || new Date().toISOString(),
    classes,
    relationships,
    shapes: Array.isArray(target.shapes) ? target.shapes : [],
    shapeEdges: Array.isArray(target.shapeEdges) ? target.shapeEdges : [],
    rationale: typeof target.rationale === 'string' ? target.rationale : '',
    documentType: target.documentType || 'canvas',
  };
}

export function getActiveLearnerKey(user?: { id: string } | null): string {
  if (user && user.id) {
    return `user_${user.id}`;
  }
  return `guest_${getLearnerSessionId()}`;
}

export function getDraftStorageKey(problemSlug: string, learnerId?: string): string {
  const learner = learnerId || getActiveLearnerKey();
  return `designdojo_draft_${learner}_${problemSlug}`;
}

export function getLegacyDraftStorageKey(problemSlug: string): string {
  return `designdojo_draft_${problemSlug}`;
}

export function loadDraft(problemSlug: string, learnerId?: string): DiagramDraft | null {
  try {
    const key = getDraftStorageKey(problemSlug, learnerId);
    const raw = localStorage.getItem(key);

    if (!raw) {
      // If guest mode or legacy guest, check legacy key only if not authenticated user
      if (!learnerId || learnerId.startsWith('guest_')) {
        const legacyKey = getLegacyDraftStorageKey(problemSlug);
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          return normalizeDiagramDraft(parsed, problemSlug);
        }
      }
      return null;
    }

    const parsed = JSON.parse(raw);
    return normalizeDiagramDraft(parsed, problemSlug);
  } catch (err) {
    console.warn(`[DesignDojo] Failed to load draft for ${problemSlug}:`, err);
    return null;
  }
}

export function saveDraft(
  problemSlug: string,
  data: DiagramDraftData,
  learnerId?: string
): DiagramDraft {
  const learner = learnerId || getActiveLearnerKey();
  const draft: DiagramDraft = {
    problemSlug,
    learnerId: learner,
    version: 1,
    updatedAt: new Date().toISOString(),
    classes: data.classes,
    relationships: data.relationships,
    shapes: data.shapes || [],
    shapeEdges: data.shapeEdges || [],
    rationale: data.rationale || '',
    documentType: 'canvas',
  };

  const serialized = JSON.stringify(draft);

  // Save STRICTLY to per-learner and per-problem key (NEVER overwrite other users' drafts!)
  const key = getDraftStorageKey(problemSlug, learner);
  localStorage.setItem(key, serialized);

  return draft;
}

export function copyDraft(
  problemSlug: string,
  fromLearnerId: string,
  toLearnerId: string
): DiagramDraft | null {
  try {
    const existing = loadDraft(problemSlug, fromLearnerId);
    if (!existing || !existing.classes || existing.classes.length === 0) return null;
    return saveDraft(problemSlug, existing, toLearnerId);
  } catch {
    return null;
  }
}

export function exportDiagramToJson(
  problemSlug: string,
  data: DiagramDraftData,
  learnerId?: string
): string {
  const learner = learnerId || getLearnerSessionId();
  const exportPayload: DiagramDraft = {
    documentType: 'canvas',
    version: 1,
    problemSlug,
    learnerId: learner,
    updatedAt: new Date().toISOString(),
    classes: data.classes,
    relationships: data.relationships,
    shapes: data.shapes || [],
    shapeEdges: data.shapeEdges || [],
    rationale: data.rationale || '',
  };

  return JSON.stringify(exportPayload, null, 2);
}

export function downloadDiagramJson(problemSlug: string, jsonString: string): void {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `designdojo-${problemSlug}-draft-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseDiagramImport(fileContent: string, problemSlug?: string): DiagramDraft {
  const parsed = JSON.parse(fileContent);
  return normalizeDiagramDraft(parsed, problemSlug);
}

export function draftToSubmission(draft: DiagramDraftData): Submission {
  return {
    classes: (draft.classes || []).map((c) => ({
      ...c,
      attributes: (c.attributes || []).map((a) => ({
        ...a,
        name: typeof a.name === 'string' ? a.name.trim() : '',
        type: typeof a.type === 'string' ? a.type.trim() : '',
        visibility: normalizeVisibility(a.visibility),
      })),
      methods: (c.methods || []).map((m) => ({
        ...m,
        name: typeof m.name === 'string' ? m.name.trim() : '',
        returnType: typeof m.returnType === 'string' ? m.returnType.trim() : '',
        visibility: normalizeVisibility(m.visibility ?? '+'),
        parameters: (m.parameters || []).map((p) => ({
          name: typeof p.name === 'string' ? p.name.trim() : '',
          type: typeof p.type === 'string' ? p.type.trim() : '',
        })),
      })),
    })),
    relationships: (draft.relationships || []).map((r) => ({
      ...r,
      sourceId: r.sourceId || (r as any).source,
      targetId: r.targetId || (r as any).target,
    })),
    rationale: draft.rationale || '',
  };
}
