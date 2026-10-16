import mongoose from 'mongoose';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { EvaluationService, AttemptRepository, ProblemRepository } from '../application/EvaluationService.js';
import { SubmissionSchema } from '../domain/types.js';
import { AuthUserDTO, UserRepository } from '../domain/User.js';
import { createJwtToken, hashPassword, verifyJwtToken, verifyPassword } from '../infrastructure/auth.js';
import { InMemoryUserRepository } from '../infrastructure/repositories.js';

const CreateAttemptRequestSchema = z.object({
  problemId: z.string().min(1, 'problemId is required'),
  submission: SubmissionSchema,
  basedOnAttemptId: z.string().optional(),
});

const RetryRequestSchema = z.object({
  submission: SubmissionSchema.optional(),
});

const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function extractAuthenticatedUser(req: Request): AuthUserDTO | null {
  const authHeader = req.header('authorization') || req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;
  return verifyJwtToken<AuthUserDTO>(token);
}

export function getLearnerId(req: Request): string {
  const authUser = extractAuthenticatedUser(req);
  if (authUser?.id) {
    return authUser.id;
  }
  const headerId = req.header('x-learner-id')?.trim();
  return headerId && headerId.length > 0 ? headerId : 'anonymous-demo-learner';
}

export function createApiRouter(
  problemRepo: ProblemRepository,
  attemptRepo: AttemptRepository,
  evaluationService: EvaluationService,
  userRepo: UserRepository = new InMemoryUserRepository()
): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'designdojo-server',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      mongoConnected: mongoose.connection.readyState === 1,
      timestamp: new Date().toISOString(),
    });
  });

  // Auth endpoints
  router.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = RegisterRequestSchema.parse(req.body);
      const email = parsed.email.toLowerCase().trim();
      const existing = await userRepo.findByEmail(email);
      if (existing) {
        res.status(409).json({ error: { code: 'USER_EXISTS', message: 'A user with this email already exists' } });
        return;
      }

      const id = 'usr_' + crypto.randomUUID();
      const name = parsed.name?.trim() || email.split('@')[0];
      const passwordHash = hashPassword(parsed.password);

      const created = await userRepo.create({
        id,
        email,
        passwordHash,
        name,
      });

      const userDto: AuthUserDTO = { id: created.id, email: created.email, name: created.name };
      const token = createJwtToken(userDto);

      res.status(201).json({
        data: {
          user: userDto,
          token,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = LoginRequestSchema.parse(req.body);
      const email = parsed.email.toLowerCase().trim();
      const user = await userRepo.findByEmail(email);
      if (!user) {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        return;
      }

      const isValid = verifyPassword(parsed.password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        return;
      }

      const userDto: AuthUserDTO = { id: user.id, email: user.email, name: user.name };
      const token = createJwtToken(userDto);

      res.json({
        data: {
          user: userDto,
          token,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/auth/me', async (req: Request, res: Response) => {
    const authUser = extractAuthenticatedUser(req);
    if (!authUser) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }
    const user = await userRepo.findById(authUser.id);
    if (!user) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json({
      data: {
        user: { id: user.id, email: user.email, name: user.name },
      },
    });
  });

  // Problem endpoints
  router.get('/problems', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const learnerId = getLearnerId(req);
      const [problems, attempts] = await Promise.all([
        problemRepo.findAll(),
        attemptRepo.findAllByLearner(learnerId),
      ]);

      const enriched = problems.map((p) => {
        const probAttempts = attempts.filter((a) => a.problemId === p.id);
        const latest = probAttempts[0]?.toJSON();
        const bestScore = probAttempts.reduce(
          (max, a) => Math.max(max, a.report?.totalScore ?? 0),
          0
        );
        return {
          ...p,
          learnerStats: {
            attemptCount: probAttempts.length,
            bestScore: probAttempts.length > 0 ? bestScore : null,
            latestAttempt: latest || null,
          },
        };
      });

      res.json({ data: enriched });
    } catch (err) {
      next(err);
    }
  });

  router.get('/problems/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const problem = await problemRepo.findByIdOrSlug(id);
      if (!problem) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem not found' } });
        return;
      }
      res.json({ data: problem });
    } catch (err) {
      next(err);
    }
  });

  router.get('/problems/:id/attempts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const learnerId = getLearnerId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const problem = await problemRepo.findByIdOrSlug(id);
      if (!problem) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Problem not found' } });
        return;
      }
      const attempts = await attemptRepo.findByProblem(problem.id, learnerId);
      res.json({ data: attempts.map((a) => a.toJSON()) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/attempts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const learnerId = getLearnerId(req);
      const attempts = await attemptRepo.findAllByLearner(learnerId);
      res.json({ data: attempts.map((a) => a.toJSON()) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/attempts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const learnerId = getLearnerId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const attempt = await attemptRepo.findById(id, learnerId);
      if (!attempt) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attempt not found' } });
        return;
      }
      res.json({ data: attempt.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/attempts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const learnerId = getLearnerId(req);
      const parsed = CreateAttemptRequestSchema.parse(req.body);
      const attempt = await evaluationService.submitAttempt({
        learnerId,
        problemId: parsed.problemId,
        submission: parsed.submission,
        basedOnAttemptId: parsed.basedOnAttemptId,
      });
      res.status(201).json({ data: attempt.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/attempts/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const learnerId = getLearnerId(req);
      const parsed = RetryRequestSchema.parse(req.body || {});
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const newAttempt = await evaluationService.retryAttempt({
        learnerId,
        previousAttemptId: id,
        updatedSubmission: parsed.submission,
      });
      res.status(201).json({ data: newAttempt.toJSON() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
