import { CanvasControls } from '../components/CanvasControls';
import { UserNav } from '../components/UserNav';
import { useAuth } from '../utils/AuthContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  Connection,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Plus,
  Send,
  Trash2,
  Sparkles,
  CheckCircle2,
  Info,
  RotateCcw,
  Layers,
  Undo2,
  Redo2,
  Download,
  Upload,
  Check,
  Save,
  AlertCircle,
} from 'lucide-react';
import { api, getLearnerSessionId } from '../api/client';
import {
  DiagramDraft,
  DiagramDraftData,
  getActiveLearnerKey,
  copyDraft,
  DiagramShape,
  downloadDiagramJson,
  draftToSubmission,
  exportDiagramToJson,
  loadDraft,
  parseDiagramImport,
  saveDraft,
} from '../utils/diagramPersistence';
import {
  ClassDefinition,
  ClassKind,
  PracticeAttempt,
  Problem,
  Relationship,
  RelationshipType,
  Submission,
  Visibility,
} from '../types/domain';
import { ClassNode } from '../components/ClassNode';

export interface ClientValidationError {
  message: string;
  classId?: string;
  className?: string;
  field?: string;
}

export function validateSubmission(
  classes: ClassDefinition[],
  relationships: Relationship[]
): { valid: boolean; errors: ClientValidationError[] } {
  const errors: ClientValidationError[] = [];

  if (!classes || classes.length === 0) {
    errors.push({
      message: 'At least one class or interface is required before submitting.',
    });
    return { valid: false, errors };
  }

  const classIdSet = new Set<string>();

  classes.forEach((c) => {
    classIdSet.add(c.id);
    const className = c.name?.trim() || '(Unnamed Class)';
    if (!c.name || !c.name.trim()) {
      errors.push({
        message: 'A class is missing a name. Please provide a class name.',
        classId: c.id,
        className,
        field: 'className',
      });
    }

    c.attributes.forEach((attr) => {
      if (!attr.name || !attr.name.trim()) {
        errors.push({
          message: `Class "${className}": attribute is missing a name.`,
          classId: c.id,
          className,
          field: 'attributeName',
        });
      }
      if (!attr.type || !attr.type.trim()) {
        errors.push({
          message: `Class "${className}": attribute "${attr.name || 'unnamed'}" is missing a type (e.g. string, int, boolean).`,
          classId: c.id,
          className,
          field: 'attributeType',
        });
      }
    });

    c.methods.forEach((meth) => {
      if (!meth.name || !meth.name.trim()) {
        errors.push({
          message: `Class "${className}": method is missing a name.`,
          classId: c.id,
          className,
          field: 'methodName',
        });
      }
      if (!meth.returnType || !meth.returnType.trim()) {
        errors.push({
          message: `Class "${className}" → Method "${meth.name || 'unnamed'}" is missing a return type (e.g. void, boolean, ParkingSpot).`,
          classId: c.id,
          className,
          field: 'returnType',
        });
      }
      meth.parameters.forEach((param) => {
        if (!param.name || !param.name.trim()) {
          errors.push({
            message: `Class "${className}" → Method "${meth.name || 'unnamed'}": parameter is missing a name.`,
            classId: c.id,
            className,
            field: 'paramName',
          });
        }
        if (!param.type || !param.type.trim()) {
          errors.push({
            message: `Class "${className}" → Method "${meth.name || 'unnamed'}" → Parameter "${param.name || 'unnamed'}" is missing a type (e.g. string, ParkingTicket, Vehicle).`,
            classId: c.id,
            className,
            field: 'paramType',
          });
        }
      });
    });
  });

  relationships.forEach((rel) => {
    if (!classIdSet.has(rel.sourceId) || !classIdSet.has(rel.targetId)) {
      errors.push({
        message: `Relationship "${rel.label || rel.id}" connects a deleted or non-existent class ID.`,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

const nodeTypes = { classNode: ClassNode };

const STARTER_TEMPLATES: Record<string, Submission> = {
  'parking-lot': {
    classes: [
      {
        id: 'cls-lot',
        name: 'ParkingLot',
        kind: 'class',
        attributes: [{ id: 'a1', name: 'floors', type: 'List<ParkingFloor>', visibility: '-' }],
        methods: [{ id: 'm1', name: 'issueTicket', returnType: 'ParkingTicket', visibility: '+', parameters: [{ name: 'v', type: 'Vehicle' }] }],
        layout: { x: 80, y: 60, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-floor',
        name: 'ParkingFloor',
        kind: 'class',
        attributes: [{ id: 'a2', name: 'floorNumber', type: 'int', visibility: '-' }],
        methods: [{ id: 'm2', name: 'findAvailableSpot', returnType: 'ParkingSpot', visibility: '+', parameters: [{ name: 'v', type: 'Vehicle' }] }],
        layout: { x: 420, y: 60, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-spot',
        name: 'ParkingSpot',
        kind: 'class',
        attributes: [{ id: 'a3', name: 'isOccupied', type: 'boolean', visibility: '-' }],
        methods: [{ id: 'm3', name: 'assignVehicle', returnType: 'boolean', visibility: '+', parameters: [{ name: 'v', type: 'Vehicle' }] }],
        layout: { x: 420, y: 260, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-vehicle',
        name: 'Vehicle',
        kind: 'abstract',
        attributes: [{ id: 'a4', name: 'licensePlate', type: 'string', visibility: '#' }],
        methods: [],
        layout: { x: 80, y: 260, width: 220, height: 120, rotation: 0 },
      },
      {
        id: 'cls-ticket',
        name: 'ParkingTicket',
        kind: 'class',
        attributes: [{ id: 'a5', name: 'entryTime', type: 'Date', visibility: '-' }],
        methods: [],
        layout: { x: 80, y: 430, width: 220, height: 120, rotation: 0 },
      },
      {
        id: 'cls-pricing',
        name: 'PricingStrategy',
        kind: 'interface',
        attributes: [],
        methods: [{ id: 'm4', name: 'calculateFee', returnType: 'number', visibility: '+', parameters: [{ name: 'ticket', type: 'ParkingTicket' }] }],
        layout: { x: 420, y: 430, width: 250, height: 120, rotation: 0 },
      },
    ],
    relationships: [
      { id: 'r1', sourceId: 'cls-lot', targetId: 'cls-floor', type: 'composition', label: 'manages', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
      { id: 'r2', sourceId: 'cls-floor', targetId: 'cls-spot', type: 'composition', label: 'contains', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
      { id: 'r3', sourceId: 'cls-spot', targetId: 'cls-vehicle', type: 'association', label: 'occupies', sourceMultiplicity: '1', targetMultiplicity: '0..1' },
      { id: 'r4', sourceId: 'cls-lot', targetId: 'cls-pricing', type: 'dependency', label: 'delegates fee', sourceMultiplicity: '1', targetMultiplicity: '1' },
    ],
    rationale:
      'Used Composition for ParkingLot -> ParkingFloor -> ParkingSpot lifecycle management, an abstract Vehicle base class, and a PricingStrategy interface to satisfy the Open/Closed Principle.',
  },
  'elevator-system': {
    classes: [
      {
        id: 'cls-ctrl',
        name: 'ElevatorController',
        kind: 'class',
        attributes: [{ id: 'e1', name: 'cars', type: 'List<ElevatorCar>', visibility: '-' }],
        methods: [{ id: 'em1', name: 'requestElevator', returnType: 'ElevatorCar', visibility: '+', parameters: [{ name: 'req', type: 'HallRequest' }] }],
        layout: { x: 80, y: 80, width: 250, height: 140, rotation: 0 },
      },
      {
        id: 'cls-car',
        name: 'ElevatorCar',
        kind: 'class',
        attributes: [{ id: 'e2', name: 'currentFloor', type: 'int', visibility: '-' }],
        methods: [{ id: 'em2', name: 'move', returnType: 'void', visibility: '+', parameters: [] }],
        layout: { x: 420, y: 80, width: 230, height: 140, rotation: 0 },
      },
      {
        id: 'cls-sched',
        name: 'DispatchStrategy',
        kind: 'interface',
        attributes: [],
        methods: [{ id: 'em3', name: 'selectElevator', returnType: 'ElevatorCar', visibility: '+', parameters: [{ name: 'req', type: 'HallRequest' }] }],
        layout: { x: 80, y: 290, width: 250, height: 130, rotation: 0 },
      },
      {
        id: 'cls-req',
        name: 'HallRequest',
        kind: 'class',
        attributes: [{ id: 'e3', name: 'targetFloor', type: 'int', visibility: '-' }],
        methods: [],
        layout: { x: 420, y: 290, width: 220, height: 120, rotation: 0 },
      },
    ],
    relationships: [
      { id: 'er1', sourceId: 'cls-ctrl', targetId: 'cls-car', type: 'composition', label: 'coordinates', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
      { id: 'er2', sourceId: 'cls-ctrl', targetId: 'cls-sched', type: 'dependency', label: 'routes via', sourceMultiplicity: '1', targetMultiplicity: '1' },
      { id: 'er3', sourceId: 'cls-ctrl', targetId: 'cls-req', type: 'association', label: 'handles', sourceMultiplicity: '1', targetMultiplicity: '*' },
    ],
    rationale: 'Injected DispatchStrategy into ElevatorController so scheduling algorithms (SCAN/LOOK) can be swapped without modifying ElevatorCar.',
  },
  'vending-machine': {
    classes: [
      {
        id: 'cls-vm',
        name: 'VendingMachine',
        kind: 'class',
        attributes: [{ id: 'v1', name: 'balance', type: 'number', visibility: '-' }],
        methods: [{ id: 'vm1', name: 'selectItem', returnType: 'void', visibility: '+', parameters: [{ name: 'code', type: 'string' }] }],
        layout: { x: 80, y: 80, width: 240, height: 140, rotation: 0 },
      },
      {
        id: 'cls-state',
        name: 'VendingState',
        kind: 'interface',
        attributes: [],
        methods: [{ id: 'vm2', name: 'insertMoney', returnType: 'void', visibility: '+', parameters: [{ name: 'amount', type: 'number' }] }],
        layout: { x: 420, y: 80, width: 240, height: 130, rotation: 0 },
      },
      {
        id: 'cls-inv',
        name: 'Inventory',
        kind: 'class',
        attributes: [{ id: 'v2', name: 'slots', type: 'Map<string, Product>', visibility: '-' }],
        methods: [{ id: 'vm3', name: 'deduct', returnType: 'boolean', visibility: '+', parameters: [{ name: 'code', type: 'string' }] }],
        layout: { x: 80, y: 290, width: 240, height: 130, rotation: 0 },
      },
      {
        id: 'cls-prod',
        name: 'Product',
        kind: 'class',
        attributes: [{ id: 'v3', name: 'price', type: 'number', visibility: '-' }],
        methods: [],
        layout: { x: 420, y: 290, width: 220, height: 120, rotation: 0 },
      },
    ],
    relationships: [
      { id: 'vr1', sourceId: 'cls-vm', targetId: 'cls-state', type: 'association', label: 'delegates state', sourceMultiplicity: '1', targetMultiplicity: '1' },
      { id: 'vr2', sourceId: 'cls-vm', targetId: 'cls-inv', type: 'composition', label: 'owns', sourceMultiplicity: '1', targetMultiplicity: '1' },
      { id: 'vr3', sourceId: 'cls-inv', targetId: 'cls-prod', type: 'aggregation', label: 'stocks', sourceMultiplicity: '1', targetMultiplicity: '*' },
    ],
    rationale: 'Applied State Pattern via VendingState interface to avoid sprawling conditional checks across Idle, HasMoney, and Dispensing states.',
  },
};

function calculateNextClassPosition(existingClasses: ClassDefinition[]): { x: number; y: number } {
  if (existingClasses.length === 0) {
    return { x: 180, y: 120 };
  }

  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 180;
  const GAP_X = 60;
  const GAP_Y = 60;
  const START_X = 180;
  const START_Y = 120;
  const MAX_COLS = 3;

  for (let row = 0; row < 25; row++) {
    for (let col = 0; col < MAX_COLS; col++) {
      const candX = START_X + col * (CARD_WIDTH + GAP_X);
      const candY = START_Y + row * (CARD_HEIGHT + GAP_Y);

      // Collision test against all existing classes
      const collision = existingClasses.some((c) => {
        const cx = c.layout?.x ?? START_X;
        const cy = c.layout?.y ?? START_Y;
        const cw = c.layout?.width ?? CARD_WIDTH;
        const ch = c.layout?.height ?? CARD_HEIGHT;

        return (
          candX < cx + cw + 30 &&
          candX + CARD_WIDTH + 30 > cx &&
          candY < cy + ch + 30 &&
          candY + CARD_HEIGHT + 30 > cy
        );
      });

      if (!collision) {
        return { x: candX, y: candY };
      }
    }
  }

  const maxX = Math.max(
    ...existingClasses.map((c) => (c.layout?.x ?? START_X) + (c.layout?.width ?? CARD_WIDTH))
  );
  return { x: maxX + GAP_X, y: START_Y };
}

function createFallbackProblem(slug: string): Problem {
  return {
    id: slug,
    slug,
    title: slug
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' '),
    difficulty: 'Medium',
    topics: ['OOP', 'SOLID'],
    description: `Design an object-oriented system for ${slug.replace(/-/g, ' ')}.`,
    functionalRequirements: [
      'Define core classes and interfaces',
      'Establish relationships',
      'Apply SOLID principles',
    ],
    constraints: ['Ensure clean modular separation.'],
    acceptanceCriteria: ['Valid class diagram with attributes and methods.'],
    hints: ['Identify entities, their attributes and methods.'],
  };
}

interface HistorySnapshot {
  classes: ClassDefinition[];
  relationships: Relationship[];
}

export const Workspace: React.FC = () => {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [activeTab, setActiveTab] = useState<'DESIGN' | 'EVALUATION' | 'HISTORY'>('DESIGN');
  const [leftSection, setLeftSection] = useState<'DESC' | 'HINTS' | 'HISTORY'>('DESC');

  const activeLearnerKey = getActiveLearnerKey(user);
  const activeLearnerKeyRef = useRef(activeLearnerKey);
  activeLearnerKeyRef.current = activeLearnerKey;

  const previousUserRef = useRef<string | undefined>(user?.id);

  // Prompt unauthenticated users to login when visiting the workspace directly
  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('designdojo_target_problem', window.location.pathname + window.location.search);
      openAuthModal('LOGIN', 'Please sign in or create an account to start practicing.');
    }
  }, [authLoading, user]);

  // Synchronous draft loading on initial state so canvas is never blank or overwritten
  const initialDraft = useMemo(() => {
    if (typeof window !== 'undefined' && slug) {
      return loadDraft(slug, getActiveLearnerKey(user));
    }
    return null;
  }, [slug, user?.id]);

  const [classes, setClasses] = useState<ClassDefinition[]>(() => {
    if (initialDraft && initialDraft.classes && initialDraft.classes.length > 0) {
      return initialDraft.classes;
    }
    return [];
  });
  const [relationships, setRelationships] = useState<Relationship[]>(() => {
    if (initialDraft && initialDraft.relationships) {
      return initialDraft.relationships;
    }
    return [];
  });
  const [shapes, setShapes] = useState<DiagramShape[]>(() => {
    if (initialDraft && initialDraft.shapes) {
      return initialDraft.shapes;
    }
    return [];
  });
  const [shapeEdges, setShapeEdges] = useState<any[]>(() => {
    if (initialDraft && initialDraft.shapeEdges) {
      return initialDraft.shapeEdges;
    }
    return [];
  });
  const [rationale, setRationale] = useState<string>(() => {
    if (initialDraft && initialDraft.rationale) {
      return initialDraft.rationale;
    }
    return '';
  });

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    initialDraft ? 'saved' : 'idle'
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialDraft ? initialDraft.updatedAt : null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoadedRef = useRef(false);

  // Synchronous state refs for instant persistence & beforeunload
  const classesRef = useRef(classes);
  const relationshipsRef = useRef(relationships);
  const shapesRef = useRef(shapes);
  const shapeEdgesRef = useRef(shapeEdges);
  const rationaleRef = useRef(rationale);

  classesRef.current = classes;
  relationshipsRef.current = relationships;
  shapesRef.current = shapes;
  shapeEdgesRef.current = shapeEdges;
  rationaleRef.current = rationale;
  isLoadedRef.current = isLoaded;

  // Instant persistence function
  const persistDraftImmediately = useCallback(
    (override?: {
      classes?: ClassDefinition[];
      relationships?: Relationship[];
      shapes?: DiagramShape[];
      shapeEdges?: any[];
      rationale?: string;
    }) => {
      if (!slug) return;
      const targetData: DiagramDraftData = {
        classes: override?.classes ?? classesRef.current,
        relationships: override?.relationships ?? relationshipsRef.current,
        shapes: override?.shapes ?? shapesRef.current,
        shapeEdges: override?.shapeEdges ?? shapeEdgesRef.current,
        rationale: override?.rationale ?? rationaleRef.current,
      };
      try {
        const saved = saveDraft(slug, targetData, activeLearnerKeyRef.current);
        setLastSavedAt(saved.updatedAt);
        setAutosaveStatus('saved');
      } catch (err) {
        console.warn('Failed to immediately save draft:', err);
      }
    },
    [slug]
  );

  // Synchronous flush on page reload or tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!slug) return;
      try {
        saveDraft(
          slug,
          {
            classes: classesRef.current,
            relationships: relationshipsRef.current,
            shapes: shapesRef.current,
            shapeEdges: shapeEdgesRef.current,
            rationale: rationaleRef.current,
          },
          activeLearnerKeyRef.current
        );
      } catch (e) {
        console.warn('Failed to flush draft before unload:', e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [slug]);

  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);

  const recordSnapshot = useCallback(() => {
    setPast((prev) => [
      ...prev.slice(-19),
      JSON.parse(JSON.stringify({ classes, relationships })),
    ]);
    setFuture([]);
  }, [classes, relationships]);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture((f) => [JSON.parse(JSON.stringify({ classes, relationships })), ...f]);
    setPast((p) => p.slice(0, -1));
    setClasses(previous.classes);
    setRelationships(previous.relationships);
    persistDraftImmediately({ classes: previous.classes, relationships: previous.relationships });
  }, [past, classes, relationships, persistDraftImmediately]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast((p) => [...p, JSON.parse(JSON.stringify({ classes, relationships }))]);
    setFuture((f) => f.slice(1));
    setClasses(next.classes);
    setRelationships(next.relationships);
    persistDraftImmediately({ classes: next.classes, relationships: next.relationships });
  }, [future, classes, relationships, persistDraftImmediately]);

  const [currentAttempt, setCurrentAttempt] = useState<PracticeAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ClientValidationError[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Smooth & stable node sync: preserve in-flight drag coordinates
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n]));
      return classes.map((cls) => {
        const prev = prevMap.get(cls.id);
        const posX = cls.layout?.x ?? (prev?.position.x ?? 180);
        const posY = cls.layout?.y ?? (prev?.position.y ?? 120);

        return {
          id: cls.id,
          type: 'classNode',
          position: { x: posX, y: posY },
          selected: cls.id === selectedClassId,
          data: {
            classDef: cls,
            highlighted: highlightedIds.includes(cls.id),
          },
        };
      });
    });
  }, [classes, selectedClassId, highlightedIds, setNodes]);

  useEffect(() => {
    setEdges(
      relationships.map((rel) => {
        const isHighlighted = highlightedIds.includes(rel.id);
        return {
          id: rel.id,
          source: rel.sourceId,
          target: rel.targetId,
          selected: rel.id === selectedRelId,
          label: `${rel.sourceMultiplicity || '1'}  [${rel.type}]${rel.label ? ' ' + rel.label : ''}  ${rel.targetMultiplicity || '*'}`,
          animated: rel.type === 'dependency',
          style: {
            stroke: isHighlighted ? '#f43f5e' : rel.id === selectedRelId ? '#818cf8' : '#64748b',
            strokeWidth: isHighlighted || rel.id === selectedRelId ? 2.5 : 1.8,
          },
          labelStyle: { fill: '#e2e8f0', fontSize: 10, fontFamily: 'monospace' },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
          markerEnd: {
            type: rel.type === 'inheritance' ? MarkerType.ArrowClosed : MarkerType.Arrow,
            color: isHighlighted ? '#f43f5e' : '#94a3b8',
          },
        };
      })
    );
  }, [relationships, selectedRelId, highlightedIds, setEdges]);

  const loadSubmissionIntoEditor = useCallback((sub: Submission) => {
    setClasses(JSON.parse(JSON.stringify(sub.classes || [])));
    setRelationships(JSON.parse(JSON.stringify(sub.relationships || [])));
    setRationale(sub.rationale || '');
    setSelectedClassId(null);
    setSelectedRelId(null);
    setHighlightedIds([]);
    setPast([]);
    setFuture([]);
  }, []);

  const loadDraftIntoEditor = useCallback((draft: DiagramDraft) => {
    setClasses(JSON.parse(JSON.stringify(draft.classes || [])));
    setRelationships(JSON.parse(JSON.stringify(draft.relationships || [])));
    setShapes(draft.shapes || []);
    setShapeEdges(draft.shapeEdges || []);
    setRationale(draft.rationale || '');
    setSelectedClassId(null);
    setSelectedRelId(null);
    setHighlightedIds([]);
    setPast([]);
    setFuture([]);
  }, []);

  useEffect(() => {
    if (!slug) return;
    const currentLearnerKey = getActiveLearnerKey(user);
    const prevUserId = previousUserRef.current;
    const isUserSwitch = prevUserId !== user?.id;
    previousUserRef.current = user?.id;

    // If guest just logged in, copy guest draft to user account so progress isn't lost
    if (isUserSwitch && !prevUserId && user?.id) {
      const guestKey = `guest_${getLearnerSessionId()}`;
      copyDraft(slug, guestKey, currentLearnerKey);
    }

    Promise.all([api.getProblem(slug), api.getProblemAttempts(slug)])
      .then(([probData, attList]) => {
        setProblem(probData);
        setAttempts(attList);

        const requestedAttemptId = searchParams.get('attemptId');
        if (requestedAttemptId) {
          const targetAttempt = attList.find((a) => a.id === requestedAttemptId);
          if (targetAttempt) {
            setCurrentAttempt(targetAttempt);
            loadSubmissionIntoEditor(targetAttempt.submission);
            setIsLoaded(true);
            return;
          }
        }

        // On initial mount without a user switch, retain existing classes if already in editor
        if (!isUserSwitch && classesRef.current.length > 0) {
          setIsLoaded(true);
          return;
        }

        // Load the draft strictly belonging to this current user
        const existingDraft = loadDraft(slug, currentLearnerKey);
        if (existingDraft && existingDraft.classes && existingDraft.classes.length > 0) {
          loadDraftIntoEditor(existingDraft);
          setLastSavedAt(existingDraft.updatedAt);
          setAutosaveStatus('saved');
        } else {
          // If no draft exists for this user, check their past attempt history
          const latestAttempt = attList[0];
          if (latestAttempt) {
            setCurrentAttempt(latestAttempt);
            loadSubmissionIntoEditor(latestAttempt.submission);
          } else {
            // Clean empty canvas for new user on this problem
            setClasses([]);
            setRelationships([]);
            setShapes([]);
            setShapeEdges([]);
            setRationale('');
            setSelectedClassId(null);
            setSelectedRelId(null);
            setHighlightedIds([]);
            setPast([]);
            setFuture([]);
            persistDraftImmediately({ classes: [], relationships: [], shapes: [], shapeEdges: [], rationale: '' });
          }
        }

        setIsLoaded(true);
      })
      .catch((err) => {
        console.warn('Could not load problem from API, activating fallback mode:', err);
        setProblem(createFallbackProblem(slug));

        const existingDraft = loadDraft(slug, currentLearnerKey);
        if (existingDraft && existingDraft.classes && existingDraft.classes.length > 0) {
          loadDraftIntoEditor(existingDraft);
          setLastSavedAt(existingDraft.updatedAt);
          setAutosaveStatus('saved');
        }
        setIsLoaded(true);
      });
  }, [slug, searchParams, user?.id, loadSubmissionIntoEditor, loadDraftIntoEditor, persistDraftImmediately]);

  // Debounced Autosave background fallback with isLoaded guard
  useEffect(() => {
    if (!slug || !isLoaded) return;
    setAutosaveStatus('saving');
    const timer = setTimeout(() => {
      persistDraftImmediately();
    }, 600);
    return () => clearTimeout(timer);
  }, [slug, isLoaded, classes, relationships, shapes, shapeEdges, rationale, persistDraftImmediately]);

  const handleExportDiagram = () => {
    if (!slug) return;
    const current: DiagramDraftData = {
      classes: classesRef.current,
      relationships: relationshipsRef.current,
      shapes: shapesRef.current,
      shapeEdges: shapeEdgesRef.current,
      rationale: rationaleRef.current,
    };
    const json = exportDiagramToJson(slug, current, activeLearnerKeyRef.current);
    downloadDiagramJson(slug, json);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !slug) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const draft = parseDiagramImport(content, slug);
        recordSnapshot();
        loadDraftIntoEditor(draft);
        saveDraft(slug, draft, activeLearnerKeyRef.current);
        setLastSavedAt(new Date().toISOString());
        setAutosaveStatus('saved');
      } catch (err: any) {
        setErrorMsg(`Failed to import diagram: ${err?.message || 'Invalid JSON file'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddClass = (kind: ClassKind) => {
    recordSnapshot();
    const id = 'cls-' + Math.random().toString(36).substring(2, 8);
    const pos = calculateNextClassPosition(classes);
    const newCls: ClassDefinition = {
      id,
      name: kind === 'interface' ? `I${classes.length + 1}Strategy` : `Class${classes.length + 1}`,
      kind,
      attributes:
        kind === 'interface'
          ? []
          : [{ id: 'a-' + Date.now(), name: 'id', type: 'string', visibility: '-' }],
      methods: [
        {
          id: 'm-' + Date.now(),
          name: 'execute',
          returnType: 'void',
          visibility: '+',
          parameters: [],
        },
      ],
      layout: { x: pos.x, y: pos.y, width: 240, height: 150, rotation: 0 },
    };

    const nextClasses = [...classes, newCls];
    setClasses(nextClasses);
    setSelectedClassId(id);
    setSelectedRelId(null);

    // Instant synchronous persistence
    persistDraftImmediately({ classes: nextClasses });
  };

  const handleLoadStarterTemplate = () => {
    if (!problem) return;
    const template = STARTER_TEMPLATES[problem.slug];
    if (template) {
      recordSnapshot();
      loadSubmissionIntoEditor(template);
      persistDraftImmediately({
        classes: template.classes,
        relationships: template.relationships,
        rationale: template.rationale,
      });
    }
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      recordSnapshot();
      const newRel: Relationship = {
        id: 'rel-' + Math.random().toString(36).substring(2, 8),
        sourceId: connection.source,
        targetId: connection.target,
        type: 'association',
        label: 'uses',
        sourceMultiplicity: '1',
        targetMultiplicity: '*',
      };
      const nextRels = [...relationships, newRel];
      setRelationships(nextRels);
      setSelectedRelId(newRel.id);
      setSelectedClassId(null);
      persistDraftImmediately({ relationships: nextRels });
    },
    [recordSnapshot, relationships, persistDraftImmediately]
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      setClasses((prev) => {
        const next = prev.map((c) =>
          c.id === node.id
            ? {
                ...c,
                layout: {
                  ...(c.layout || { width: 240, height: 150, rotation: 0 }),
                  x: Math.round(node.position.x),
                  y: Math.round(node.position.y),
                },
              }
            : c
        );
        persistDraftImmediately({ classes: next });
        return next;
      });
    },
    [persistDraftImmediately]
  );

  const handleNodeResize = useCallback(
    (classId: string, width: number, height: number) => {
      setClasses((prev) => {
        const next = prev.map((c) =>
          c.id === classId
            ? {
                ...c,
                layout: {
                  ...(c.layout || { x: 180, y: 120, rotation: 0 }),
                  width: Math.round(width),
                  height: Math.round(height),
                },
              }
            : c
        );
        persistDraftImmediately({ classes: next });
        return next;
      });
    },
    [persistDraftImmediately]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      recordSnapshot();
      const deletedIds = new Set(deletedNodes.map((n) => n.id));
      const nextClasses = classes.filter((c) => !deletedIds.has(c.id));
      const nextRelationships = relationships.filter(
        (r) => !deletedIds.has(r.sourceId) && !deletedIds.has(r.targetId)
      );
      setClasses(nextClasses);
      setRelationships(nextRelationships);
      if (selectedClassId && deletedIds.has(selectedClassId)) {
        setSelectedClassId(null);
      }
      persistDraftImmediately({ classes: nextClasses, relationships: nextRelationships });
    },
    [classes, relationships, selectedClassId, recordSnapshot, persistDraftImmediately]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      recordSnapshot();
      const deletedIds = new Set(deletedEdges.map((e) => e.id));
      const nextRelationships = relationships.filter((r) => !deletedIds.has(r.id));
      setRelationships(nextRelationships);
      if (selectedRelId && deletedIds.has(selectedRelId)) {
        setSelectedRelId(null);
      }
      persistDraftImmediately({ relationships: nextRelationships });
    },
    [relationships, selectedRelId, recordSnapshot, persistDraftImmediately]
  );

  const handleDeleteSelected = () => {
    recordSnapshot();
    let nextClasses = classes;
    let nextRelationships = relationships;

    if (selectedClassId) {
      nextClasses = classes.filter((c) => c.id !== selectedClassId);
      nextRelationships = relationships.filter(
        (r) => r.sourceId !== selectedClassId && r.targetId !== selectedClassId
      );
      setClasses(nextClasses);
      setRelationships(nextRelationships);
      setSelectedClassId(null);
    } else if (selectedRelId) {
      nextRelationships = relationships.filter((r) => r.id !== selectedRelId);
      setRelationships(nextRelationships);
      setSelectedRelId(null);
    }

    persistDraftImmediately({ classes: nextClasses, relationships: nextRelationships });
  };

  const handleSubmitDesign = async () => {
    if (!problem) return;

    if (!user) {
      openAuthModal('LOGIN', 'Please sign in or create an account to submit your design for evaluation.');
      return;
    }

    // Pre-flight client validation before sending to API
    const validation = validateSubmission(classes, relationships);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setErrorMsg(`Submission blocked: Please resolve ${validation.errors.length} validation issue(s) before submitting.`);
      return;
    }
    setValidationErrors([]);
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const submission: Submission = draftToSubmission({ classes, relationships, rationale });
      const attempt = await api.submitAttempt(problem.id, submission, currentAttempt?.id);
      setCurrentAttempt(attempt);
      setAttempts((prev) => [attempt, ...prev]);
      setActiveTab('EVALUATION');
      if (attempt.status === 'FAILED') {
        setErrorMsg(attempt.failureReason || 'Evaluation failed to complete');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryFromAttempt = async (att: PracticeAttempt) => {
    loadSubmissionIntoEditor(att.submission);
    setCurrentAttempt(att);
    setActiveTab('DESIGN');
  };

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const selectedRel = useMemo(
    () => relationships.find((r) => r.id === selectedRelId) || null,
    [relationships, selectedRelId]
  );

  const updateSelectedClass = (updater: (c: ClassDefinition) => ClassDefinition) => {
    if (!selectedClassId) return;
    setClasses((prev) => {
      const next = prev.map((c) => (c.id === selectedClassId ? updater(c) : c));
      persistDraftImmediately({ classes: next });
      return next;
    });
  };

  const updateSelectedRel = (updater: (r: Relationship) => Relationship) => {
    if (!selectedRelId) return;
    setRelationships((prev) => {
      const next = prev.map((r) => (r.id === selectedRelId ? updater(r) : r));
      persistDraftImmediately({ relationships: next });
      return next;
    });
  };

  if (!problem) {
    return (
      <div className="h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-white">{problem.title}</h1>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-medium">
                {problem.difficulty}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['DESIGN', 'EVALUATION', 'HISTORY'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1 rounded-md text-xs font-medium transition ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'DESIGN'
                ? '1. Design Canvas'
                : tab === 'EVALUATION'
                ? `2. Evaluation ${
                    currentAttempt?.report ? `(${currentAttempt.report.totalScore}/100)` : ''
                  }`
                : `3. Attempt History (${attempts.length})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden file input for diagram JSON import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileImport}
            className="hidden"
          />

          {/* Autosave status indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 mr-1 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800"
            title={
              lastSavedAt
                ? `Last autosaved at ${new Date(lastSavedAt).toLocaleTimeString()}`
                : 'Autosave active'
            }
          >
            {autosaveStatus === 'saving' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300">Saving...</span>
              </>
            ) : autosaveStatus === 'saved' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>Autosave</span>
              </>
            )}
          </div>

          {/* Export Diagram JSON Action */}
          <button
            onClick={handleExportDiagram}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition shadow-sm"
            title="Export full diagram in-memory state as downloadable JSON"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Export JSON</span>
          </button>

          {/* Import / Recover Diagram JSON Action */}
          <button
            onClick={handleImportClick}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition shadow-sm"
            title="Import or recover diagram from an exported JSON or backup file"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Import JSON</span>
          </button>

          {STARTER_TEMPLATES[problem.slug] && (
            <button
              onClick={handleLoadStarterTemplate}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
              title="Load starter reference template"
            >
              Load Reference Template
            </button>
          )}
          <button
            onClick={handleSubmitDesign}
            disabled={submitting || classes.length === 0}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Evaluating...' : 'Submit Design'}</span>
          </button>

          <div className="w-px h-6 bg-slate-800 mx-1" />
          <UserNav compact />
        </div>
      </header>

      {validationErrors.length > 0 && (
        <div className="bg-rose-950/95 border-b border-rose-500/60 px-4 py-3 text-xs text-rose-100 shadow-xl space-y-2">
          <div className="flex items-center justify-between font-bold text-rose-300">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              Submission Blocked: {validationErrors.length} required field(s) missing or incomplete
            </span>
            <button
              onClick={() => {
                setValidationErrors([]);
                setErrorMsg(null);
              }}
              className="text-[11px] text-rose-300 hover:text-white underline"
            >
              Dismiss
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1.5 pl-5">
            {validationErrors.map((err: ClientValidationError, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 text-rose-200 text-[11px]">
                <span className="leading-snug">• {err.message}</span>
                {err.classId && (
                  <button
                    onClick={() => {
                      setSelectedClassId(err.classId!);
                      setSelectedRelId(null);
                      setHighlightedIds([err.classId!]);
                      setActiveTab('DESIGN');
                    }}
                    className="shrink-0 px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-[10px] text-rose-100 border border-rose-500/50 transition font-mono"
                  >
                    Edit {err.className || 'Class'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {errorMsg && validationErrors.length === 0 && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 px-4 py-2 text-xs text-rose-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <aside className="col-span-3 border-r border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-800 text-xs font-medium bg-slate-900">
            <button
              onClick={() => setLeftSection('DESC')}
              className={`flex-1 py-2.5 border-b-2 ${
                leftSection === 'DESC'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400'
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setLeftSection('HINTS')}
              className={`flex-1 py-2.5 border-b-2 ${
                leftSection === 'HINTS'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400'
              }`}
            >
              Hints ({problem.hints.length})
            </button>
            <button
              onClick={() => setLeftSection('HISTORY')}
              className={`flex-1 py-2.5 border-b-2 ${
                leftSection === 'HISTORY'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400'
              }`}
            >
              History ({attempts.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs leading-relaxed">
            {leftSection === 'DESC' && (
              <>
                <div>
                  <h3 className="text-slate-100 font-semibold text-sm mb-1">Problem Statement</h3>
                  <p className="text-slate-300">{problem.description}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-2">
                    Functional Requirements
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-300">
                    {problem.functionalRequirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-2">
                    Architectural Constraints
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-300">
                    {problem.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-2">
                    Acceptance Criteria
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-emerald-300/90">
                    {problem.acceptanceCriteria.map((ac, i) => (
                      <li key={i}>{ac}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="block font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-1.5">
                    Design Rationale & Trade-Offs
                  </label>
                  <textarea
                    rows={4}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Explain your design patterns, SOLID choices, and concurrency assumptions..."
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            {leftSection === 'HINTS' && (
              <div className="space-y-3">
                {problem.hints.map((h, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-indigo-200"
                  >
                    <span className="font-bold mr-1">Hint #{i + 1}:</span> {h}
                  </div>
                ))}
              </div>
            )}

            {leftSection === 'HISTORY' && (
              <div className="space-y-2.5">
                {attempts.length === 0 ? (
                  <p className="text-slate-500 text-center py-6">No previous attempts yet.</p>
                ) : (
                  attempts.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">
                          Attempt #{att.attemptNumber}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {att.report ? `${att.report.totalScore}/100` : att.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(att.createdAt).toLocaleString()}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            setCurrentAttempt(att);
                            loadSubmissionIntoEditor(att.submission);
                            setActiveTab('EVALUATION');
                          }}
                          className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                        >
                          Inspect Report
                        </button>
                        <button
                          onClick={() => handleRetryFromAttempt(att)}
                          className="flex-1 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px]"
                        >
                          Retry From This
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        <section className="col-span-6 relative bg-slate-950 flex flex-col overflow-hidden">
          {activeTab === 'DESIGN' && (
            <>
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/95 border border-slate-800 p-1.5 rounded-xl shadow-xl">
                <button
                  onClick={() => handleAddClass('class')}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Class</span>
                </button>
                <button
                  onClick={() => handleAddClass('interface')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Interface</span>
                </button>
                <button
                  onClick={() => handleAddClass('abstract')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Abstract</span>
                </button>
                <div className="h-4 w-px bg-slate-800 mx-0.5" />
                <button
                  onClick={handleUndo}
                  disabled={past.length === 0}
                  title="Undo"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  title="Redo"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                {(selectedClassId || selectedRelId) && (
                  <button
                    onClick={handleDeleteSelected}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <div className="flex-1 w-full h-full">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeDragStop={onNodeDragStop}
                  onNodesDelete={onNodesDelete}
                  onEdgesDelete={onEdgesDelete}
                  nodeTypes={nodeTypes}
                  onNodeClick={(_e, node) => {
                    setSelectedClassId(node.id);
                    setSelectedRelId(null);
                  }}
                  onEdgeClick={(_e, edge) => {
                    setSelectedRelId(edge.id);
                    setSelectedClassId(null);
                  }}
                  onPaneClick={() => {
                    setSelectedClassId(null);
                    setSelectedRelId(null);
                    setHighlightedIds([]);
                  }}
                  fitView
                >
                  <Background color="#1e293b" gap={20} />
                  <Controls position="bottom-left" showInteractive={false} className="!border-slate-700 !bg-slate-900" />
                  <CanvasControls />
                </ReactFlow>
              </div>
            </>
          )}

          {activeTab === 'EVALUATION' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {submitting ? (
                <div className="text-center py-20 space-y-3">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium text-white">
                    Evaluating your architecture...
                  </p>
                  <p className="text-xs text-slate-400">
                    Running Rule-based and Gemini AI evaluation across requirements, coupling, and SOLID principles.
                  </p>
                </div>
              ) : currentAttempt?.status === 'FAILED' ? (
                <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-500/40 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-rose-200">Evaluation Could Not Complete</h3>
                  <p className="text-xs text-rose-300 max-w-md mx-auto">
                    {currentAttempt.failureReason || 'An unexpected error occurred during evaluation.'}
                  </p>
                  <button
                    onClick={handleSubmitDesign}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                  >
                    Retry Submission
                  </button>
                </div>
              ) : !currentAttempt?.report ? (
                <div className="text-center py-20 space-y-3">
                  <Sparkles className="w-10 h-10 text-indigo-400 mx-auto opacity-70" />
                  <p className="text-sm text-slate-300">
                    No evaluation report selected. Click <strong>Submit Design</strong> to evaluate your class diagram.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        Attempt #{currentAttempt.attemptNumber} Evaluation
                      </span>
                      <div className="text-3xl font-extrabold text-white mt-1">
                        {currentAttempt.report.totalScore}{' '}
                        <span className="text-base font-normal text-slate-400">/ 100</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
                        <span>
                          Strategy:{' '}
                          <strong className="text-indigo-300 font-medium">
                            {currentAttempt.report.evaluatorMetadata.strategyUsed === 'HYBRID_AI'
                              ? 'AI-Assisted Hybrid Evaluation'
                              : 'Rule-Based Evaluation'}
                          </strong>
                        </span>
                        {currentAttempt.report.evaluatorMetadata.fallbackTriggered && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Fallback Active
                          </span>
                        )}
                        {currentAttempt.report.evaluatorMetadata.fallbackReason && (
                          <span className="text-amber-400">
                            ({currentAttempt.report.evaluatorMetadata.fallbackReason})
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRetryFromAttempt(currentAttempt)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Refine & Retry Attempt</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { label: 'Requirements', val: currentAttempt.report.criterionScores.requirementCoverage, max: 25 },
                      { label: 'Cohesion', val: currentAttempt.report.criterionScores.responsibilitiesAndCohesion, max: 20 },
                      { label: 'Coupling', val: currentAttempt.report.criterionScores.relationshipsAndCoupling, max: 20 },
                      { label: 'Abstractions', val: currentAttempt.report.criterionScores.extensibilityAndAbstractions, max: 20 },
                      { label: 'Behaviour', val: currentAttempt.report.criterionScores.behaviourAndRationale, max: 15 },
                    ].map((c) => (
                      <div key={c.label} className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-center">
                        <div className="text-[11px] text-slate-400">{c.label}</div>
                        <div className="text-base font-bold text-slate-100 mt-0.5">
                          {c.val}/{c.max}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Architectural Strengths
                    </h3>
                    <div className="space-y-1.5">
                      {currentAttempt.report.strengths.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Specific Findings & Evidence (Click to Highlight on Canvas)
                    </h3>
                    {currentAttempt.report.findings.length === 0 ? (
                      <p className="text-xs text-slate-400">No issues detected! Excellent design.</p>
                    ) : (
                      currentAttempt.report.findings.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => {
                            if (f.affectedElementIds.length > 0) {
                              setHighlightedIds(f.affectedElementIds);
                              setActiveTab('DESIGN');
                            }
                          }}
                          className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                f.severity === 'ERROR'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : f.severity === 'WARNING'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-sky-500/20 text-sky-300'
                              }`}
                            >
                              {f.severity} • {f.criterion} ({f.source})
                            </span>
                            {f.affectedElementIds.length > 0 && (
                              <span className="text-[11px] text-indigo-400 underline">
                                Highlight {f.affectedElementIds.join(', ')} on Canvas
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-white">{f.observation}</p>
                          <p className="text-xs text-slate-300">{f.explanation}</p>
                          <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                            <strong>Evidence:</strong> {f.evidence}
                          </div>
                          <div className="text-xs text-emerald-300">
                            <strong>Recommendation:</strong> {f.recommendation}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h2 className="text-base font-bold text-white">
                Immutable Attempt History ({attempts.length})
              </h2>
              {attempts.map((att) => (
                <div
                  key={att.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        Attempt #{att.attemptNumber}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono">
                        {att.report ? `${att.report.totalScore}/100` : att.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {att.submission.classes.length} classes, {att.submission.relationships.length}{' '}
                      relationships • {new Date(att.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCurrentAttempt(att);
                        loadSubmissionIntoEditor(att.submission);
                        setActiveTab('EVALUATION');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                    >
                      View Report
                    </button>
                    <button
                      onClick={() => handleRetryFromAttempt(att)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium"
                    >
                      Start New Attempt From Snapshot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="col-span-3 border-l border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Property Inspector</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
            {!selectedClass && !selectedRel && (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <Info className="w-7 h-7 mx-auto opacity-50" />
                <p>Select a Class node or Relationship edge on the canvas to inspect and edit its properties.</p>
              </div>
            )}

            {selectedClass && (
              <>
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Visual Layout (Canvas Coordinates)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'X', key: 'x', val: selectedClass.layout?.x ?? 100 },
                      { label: 'Y', key: 'y', val: selectedClass.layout?.y ?? 100 },
                      { label: 'W', key: 'width', val: selectedClass.layout?.width ?? 220 },
                      { label: 'H', key: 'height', val: selectedClass.layout?.height ?? 140 },
                      { label: 'Rot°', key: 'rotation', val: selectedClass.layout?.rotation ?? 0 },
                    ].map((coord) => (
                      <div
                        key={coord.key}
                        className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1"
                      >
                        <span className="text-[10px] text-slate-500 w-7">{coord.label}</span>
                        <input
                          type="number"
                          value={coord.val}
                          onChange={(e) =>
                            updateSelectedClass((c) => ({
                              ...c,
                              layout: {
                                ...(c.layout || { x: 100, y: 100, width: 220, height: 140, rotation: 0 }),
                                [coord.key]: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full bg-transparent text-right text-slate-200 font-mono focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Semantic Class Properties
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Class Name *</label>
                    <input
                      type="text"
                      value={selectedClass.name}
                      onChange={(e) =>
                        updateSelectedClass((c) => ({ ...c, name: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Stereotype / Kind</label>
                    <select
                      value={selectedClass.kind}
                      onChange={(e) =>
                        updateSelectedClass((c) => ({
                          ...c,
                          kind: e.target.value as ClassKind,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100"
                    >
                      <option value="class">Concrete Class</option>
                      <option value="interface">Interface (&lt;&lt;interface&gt;&gt;)</option>
                      <option value="abstract">Abstract Class (&lt;&lt;abstract&gt;&gt;)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Attributes ({selectedClass.attributes.length})
                    </span>
                    <button
                      onClick={() =>
                        updateSelectedClass((c) => ({
                          ...c,
                          attributes: [
                            ...c.attributes,
                            {
                              id: 'attr-' + Date.now(),
                              name: 'field' + (c.attributes.length + 1),
                              type: 'string',
                              visibility: '-',
                            },
                          ],
                        }))
                      }
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 text-[11px]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>

                  {selectedClass.attributes.map((attr, idx) => (
                    <div key={attr.id} className="flex items-center gap-1.5">
                      <select
                        value={attr.visibility}
                        onChange={(e) =>
                          updateSelectedClass((c) => {
                            const next = [...c.attributes];
                            next[idx] = { ...attr, visibility: e.target.value as Visibility };
                            return { ...c, attributes: next };
                          })
                        }
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 font-mono text-indigo-300"
                      >
                        <option value="+">+</option>
                        <option value="-">-</option>
                        <option value="#">#</option>
                      </select>
                      <input
                        type="text"
                        value={attr.name}
                        onChange={(e) =>
                          updateSelectedClass((c) => {
                            const next = [...c.attributes];
                            next[idx] = { ...attr, name: e.target.value };
                            return { ...c, attributes: next };
                          })
                        }
                        placeholder="name"
                        className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono"
                      />
                      <input
                        type="text"
                        value={attr.type}
                        onChange={(e) =>
                          updateSelectedClass((c) => {
                            const next = [...c.attributes];
                            next[idx] = { ...attr, type: e.target.value };
                            return { ...c, attributes: next };
                          })
                        }
                        placeholder="type (e.g. string)"
                        title={
                          !attr.type || !attr.type.trim()
                            ? 'Attribute type is required (e.g. string, int)'
                            : undefined
                        }
                        className={`flex-1 bg-slate-950 border rounded px-2 py-1 font-mono text-amber-300 ${
                          !attr.type || !attr.type.trim()
                            ? 'border-rose-500/80 bg-rose-950/30 ring-1 ring-rose-500/40'
                            : 'border-slate-800'
                        }`}
                      />
                      <button
                        onClick={() =>
                          updateSelectedClass((c) => ({
                            ...c,
                            attributes: c.attributes.filter((a) => a.id !== attr.id),
                          }))
                        }
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Methods ({selectedClass.methods.length})
                    </span>
                    <button
                      onClick={() =>
                        updateSelectedClass((c) => ({
                          ...c,
                          methods: [
                            ...c.methods,
                            {
                              id: 'meth-' + Date.now(),
                              name: 'operation' + (c.methods.length + 1),
                              returnType: 'void',
                              visibility: '+',
                              parameters: [],
                            },
                          ],
                        }))
                      }
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 text-[11px]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>

                  {selectedClass.methods.map((meth, idx) => (
                    <div
                      key={meth.id}
                      className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <select
                          value={meth.visibility}
                          onChange={(e) =>
                            updateSelectedClass((c) => {
                              const next = [...c.methods];
                              next[idx] = { ...meth, visibility: e.target.value as Visibility };
                              return { ...c, methods: next };
                            })
                          }
                          className="bg-slate-900 border border-slate-800 rounded px-1.5 py-1 font-mono text-emerald-300"
                        >
                          <option value="+">+</option>
                          <option value="-">-</option>
                          <option value="#">#</option>
                        </select>
                        <input
                          type="text"
                          value={meth.name}
                          onChange={(e) =>
                            updateSelectedClass((c) => {
                              const next = [...c.methods];
                              next[idx] = { ...meth, name: e.target.value };
                              return { ...c, methods: next };
                            })
                          }
                          placeholder="methodName"
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono"
                        />
                        <input
                          type="text"
                          value={meth.returnType}
                          onChange={(e) =>
                            updateSelectedClass((c) => {
                              const next = [...c.methods];
                              next[idx] = { ...meth, returnType: e.target.value };
                              return { ...c, methods: next };
                            })
                          }
                          placeholder="returnType"
                          title={
                            !meth.returnType || !meth.returnType.trim()
                              ? 'Return type is required (e.g. void, boolean, ParkingSpot)'
                              : undefined
                          }
                          className={`w-28 bg-slate-900 border rounded px-2 py-1 font-mono text-sky-300 ${
                            !meth.returnType || !meth.returnType.trim()
                              ? 'border-rose-500/80 bg-rose-950/30 ring-1 ring-rose-500/40'
                              : 'border-slate-800'
                          }`}
                        />
                        <button
                          onClick={() =>
                            updateSelectedClass((c) => ({
                              ...c,
                              methods: c.methods.filter((m) => m.id !== meth.id),
                            }))
                          }
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="pl-2 border-l border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Parameters ({meth.parameters.length})</span>
                          <button
                            onClick={() =>
                              updateSelectedClass((c) => {
                                const next = [...c.methods];
                                next[idx] = {
                                  ...meth,
                                  parameters: [
                                    ...meth.parameters,
                                    { name: 'arg' + (meth.parameters.length + 1), type: 'string' },
                                  ],
                                };
                                return { ...c, methods: next };
                              })
                            }
                            className="text-indigo-400 hover:underline"
                          >
                            + Param
                          </button>
                        </div>
                        {meth.parameters.map((param, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-1">
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) =>
                                updateSelectedClass((c) => {
                                  const next = [...c.methods];
                                  const nextParams = [...meth.parameters];
                                  nextParams[pIdx] = { ...param, name: e.target.value };
                                  next[idx] = { ...meth, parameters: nextParams };
                                  return { ...c, methods: next };
                                })
                              }
                              placeholder="param"
                              className="w-20 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono"
                            />
                            <input
                              type="text"
                              value={param.type}
                              onChange={(e) =>
                                updateSelectedClass((c) => {
                                  const next = [...c.methods];
                                  const nextParams = [...meth.parameters];
                                  nextParams[pIdx] = { ...param, type: e.target.value };
                                  next[idx] = { ...meth, parameters: nextParams };
                                  return { ...c, methods: next };
                                })
                              }
                              placeholder="type (e.g. ParkingTicket)"
                              title={
                                !param.type || !param.type.trim()
                                  ? 'Parameter type is required (e.g. ParkingTicket, Vehicle)'
                                  : undefined
                              }
                              className={`flex-1 bg-slate-900 border rounded px-1.5 py-0.5 text-[10px] font-mono text-amber-300 ${
                                !param.type || !param.type.trim()
                                  ? 'border-rose-500/80 bg-rose-950/30 ring-1 ring-rose-500/40'
                                  : 'border-slate-800'
                              }`}
                            />
                            <button
                              onClick={() =>
                                updateSelectedClass((c) => {
                                  const next = [...c.methods];
                                  next[idx] = {
                                    ...meth,
                                    parameters: meth.parameters.filter((_, i) => i !== pIdx),
                                  };
                                  return { ...c, methods: next };
                                })
                              }
                              className="text-slate-500 hover:text-rose-400 text-[10px] px-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {selectedRel && (
              <div className="space-y-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Relationship Properties
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Relationship Type</label>
                  <select
                    value={selectedRel.type}
                    onChange={(e) =>
                      updateSelectedRel((r) => ({
                        ...r,
                        type: e.target.value as RelationshipType,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100"
                  >
                    <option value="association">Association (uses / links)</option>
                    <option value="inheritance">Inheritance (is-a / extends)</option>
                    <option value="composition">Composition (strong lifecycle has-a)</option>
                    <option value="aggregation">Aggregation (shared has-a)</option>
                    <option value="dependency">Dependency (dashed uses)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Source Class</label>
                    <select
                      value={selectedRel.sourceId}
                      onChange={(e) =>
                        updateSelectedRel((r) => ({ ...r, sourceId: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Target Class</label>
                    <select
                      value={selectedRel.targetId}
                      onChange={(e) =>
                        updateSelectedRel((r) => ({ ...r, targetId: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Source Multiplicity
                    </label>
                    <input
                      type="text"
                      value={selectedRel.sourceMultiplicity || '1'}
                      onChange={(e) =>
                        updateSelectedRel((r) => ({ ...r, sourceMultiplicity: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Target Multiplicity
                    </label>
                    <input
                      type="text"
                      value={selectedRel.targetMultiplicity || '*'}
                      onChange={(e) =>
                        updateSelectedRel((r) => ({ ...r, targetMultiplicity: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Label / Role</label>
                  <input
                    type="text"
                    value={selectedRel.label || ''}
                    onChange={(e) =>
                      updateSelectedRel((r) => ({ ...r, label: e.target.value }))
                    }
                    placeholder="e.g., manages, delegates to"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800"
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
