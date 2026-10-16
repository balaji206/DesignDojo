import { AuthUser, PracticeAttempt, Problem, Submission } from '../types/domain';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 'http://localhost:4000/api';

export function getLearnerSessionId(): string {
  const key = 'designdojo_learner_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'learner_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem(key, id);
  }
  return id;
}

export function getAuthToken(): string | null {
  return localStorage.getItem('designdojo_auth_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('designdojo_auth_token', token);
  } else {
    localStorage.removeItem('designdojo_auth_token');
  }
}

export class ApiError extends Error {
  code?: string;
  details?: Array<{ path: string; message: string }>;

  constructor(message: string, code?: string, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-learner-id': getLearnerSessionId(),
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorInfo = json?.error;
    let detailMsg = errorInfo?.message || 'API request failed';
    if (errorInfo?.details && Array.isArray(errorInfo.details) && errorInfo.details.length > 0) {
      const formatted = errorInfo.details
        .map((d: any) => `${d.path}: ${d.message}`)
        .join('; ');
      detailMsg = `${errorInfo.message || 'Validation error'}: ${formatted}`;
    }
    throw new ApiError(detailMsg, errorInfo?.code, errorInfo?.details);
  }
  return json.data as T;
}

export const api = {
  // Auth methods
  register: (email: string, password: string, name?: string) =>
    apiFetch<{ user: AuthUser; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    apiFetch<{ user: AuthUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => apiFetch<{ user: AuthUser }>('/auth/me'),

  // Practice & Problem methods
  getProblems: () => apiFetch<Problem[]>('/problems'),
  getProblem: (idOrSlug: string) => apiFetch<Problem>(`/problems/${idOrSlug}`),
  getProblemAttempts: (idOrSlug: string) =>
    apiFetch<PracticeAttempt[]>(`/problems/${idOrSlug}/attempts`),
  getAllAttempts: () => apiFetch<PracticeAttempt[]>('/attempts'),
  submitAttempt: (problemId: string, submission: Submission, basedOnAttemptId?: string) =>
    apiFetch<PracticeAttempt>('/attempts', {
      method: 'POST',
      body: JSON.stringify({ problemId, submission, basedOnAttemptId }),
    }),
  retryAttempt: (attemptId: string, submission?: Submission) =>
    apiFetch<PracticeAttempt>(`/attempts/${attemptId}/retry`, {
      method: 'POST',
      body: JSON.stringify({ submission }),
    }),
};
