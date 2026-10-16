import { UserRepository } from './domain/User.js';
import express from 'express';
import cors from 'cors';
import { AttemptRepository, EvaluationService, ProblemRepository } from './application/EvaluationService.js';
import { EvaluationStrategy } from './application/Evaluator.js';
import { createApiRouter } from './api/routes.js';
import { errorHandler } from './api/errorHandler.js';

export function createApp(deps: {
  problemRepo: ProblemRepository;
  attemptRepo: AttemptRepository;
  evaluator: EvaluationStrategy;
  userRepo?: UserRepository;
}) {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || '*',
      allowedHeaders: ['Content-Type', 'x-learner-id', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '512kb' }));

  const evaluationService = new EvaluationService(
    deps.problemRepo,
    deps.attemptRepo,
    deps.evaluator
  );

  app.use('/api', createApiRouter(deps.problemRepo, deps.attemptRepo, evaluationService, deps.userRepo));
  app.use(errorHandler);

  return app;
}
