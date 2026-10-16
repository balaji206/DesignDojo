import 'dotenv/config';
import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import { createApp } from './app.js';
import {
  MongoAttemptRepository,
  MongoProblemRepository,
  InMemoryAttemptRepository,
  InMemoryProblemRepository,
  MongoUserRepository,
  InMemoryUserRepository,
} from './infrastructure/repositories.js';
import { UserRepository } from './domain/User.js';
import { ProblemRepository, AttemptRepository } from './application/EvaluationService.js';
import { AIEvaluator, HybridEvaluator, RuleBasedEvaluator } from './application/Evaluator.js';

async function bootstrap() {
  const port = Number(process.env.PORT || 4000);
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/designdojo';

  let problemRepo: ProblemRepository;
  let attemptRepo: AttemptRepository;
  let userRepo: UserRepository;

  try {
    console.log('[DesignDojo] Connecting to MongoDB cluster...');
    await mongoose.connect(mongoUri, {
      dbName: 'designdojo',
      serverSelectionTimeoutMS: 15000,
    });
    console.log('[DesignDojo] Successfully connected to MongoDB Atlas cluster (db: designdojo)');
    const mongoProblemRepo = new MongoProblemRepository();
    await mongoProblemRepo.ensureSeeded();
    problemRepo = mongoProblemRepo;
    attemptRepo = new MongoAttemptRepository();
    userRepo = new MongoUserRepository();
  } catch (err: any) {
    console.warn(`[DesignDojo] MongoDB not available (${err?.message || 'connection failed'}).`);
    console.log('[DesignDojo] Running with In-Memory repository (seeded with 3 problems).');
    const inMemoryProblemRepo = new InMemoryProblemRepository();
    await inMemoryProblemRepo.ensureSeeded();
    problemRepo = inMemoryProblemRepo;
    attemptRepo = new InMemoryAttemptRepository();
    userRepo = new InMemoryUserRepository();
  }

  const ruleEvaluator = new RuleBasedEvaluator();
  let aiEvaluator: AIEvaluator | undefined;

  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  );
  const hasGroq = Boolean(
    process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here'
  );

  if (hasGemini || hasGroq) {
    const geminiClient = hasGemini ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }) : null;
    const geminiPrimary = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const geminiFallback = 'gemini-2.5-flash-lite';

    const groqKey = process.env.GROQ_API_KEY;
    const groqPrimary = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    const groqFallback = 'openai/gpt-oss-20b';

    const executeGemini = async (model: string, prompt: string, timeoutMs: number): Promise<string> => {
      if (!geminiClient) throw new Error('Gemini API is not configured');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini (${model}) timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      const responsePromise = geminiClient.models
        .generateContent({
          model,
          contents: prompt,
          config: {
            thinkingConfig: { includeThoughts: false },
            temperature: 0.2,
          },
        })
        .then((r) => r.text || '');

      return Promise.race([responsePromise, timeoutPromise]);
    };

    const executeGroq = async (model: string, prompt: string, timeoutMs: number): Promise<string> => {
      if (!groqKey) throw new Error('Groq API is not configured');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Groq (${model}) HTTP ${res.status}: ${errText.slice(0, 150)}`);
        }

        const data: any = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error(`Groq (${model}) returned empty response`);
        return content;
      } finally {
        clearTimeout(timer);
      }
    };

    aiEvaluator = new AIEvaluator(
      async (prompt, timeoutMs) => {
        // Step 1: Try Primary Gemini
        if (hasGemini) {
          const start = Date.now();
          try {
            const text = await executeGemini(geminiPrimary, prompt, timeoutMs);
            console.log(`[AI Evaluator] Gemini (${geminiPrimary}) succeeded in ${Date.now() - start}ms`);
            return { text, modelUsed: `Gemini (${geminiPrimary})` };
          } catch (err: any) {
            console.warn(`[AI Evaluator] Gemini (${geminiPrimary}) failed: ${err.message}. Retrying Gemini Lite...`);
          }

          // Step 2: Try Gemini Fallback
          const liteStart = Date.now();
          try {
            const text = await executeGemini(geminiFallback, prompt, 8000);
            console.log(`[AI Evaluator] Gemini Fallback (${geminiFallback}) succeeded in ${Date.now() - liteStart}ms`);
            return { text, modelUsed: `Gemini (${geminiFallback})` };
          } catch (err: any) {
            console.warn(`[AI Evaluator] Gemini Fallback (${geminiFallback}) failed: ${err.message}. Falling back to Groq...`);
          }
        }

        // Step 3: Try Groq Primary (openai/gpt-oss-120b)
        if (hasGroq) {
          const groqStart = Date.now();
          try {
            const text = await executeGroq(groqPrimary, prompt, 8000);
            console.log(`[AI Evaluator] Groq Fallback (${groqPrimary}) succeeded in ${Date.now() - groqStart}ms`);
            return { text, modelUsed: `Groq (${groqPrimary})` };
          } catch (err: any) {
            console.warn(`[AI Evaluator] Groq (${groqPrimary}) failed: ${err.message}. Trying Groq Fast Fallback...`);
          }

          // Step 4: Try Groq Fast Fallback (openai/gpt-oss-20b)
          const groq20bStart = Date.now();
          try {
            const text = await executeGroq(groqFallback, prompt, 6000);
            console.log(`[AI Evaluator] Groq Fallback (${groqFallback}) succeeded in ${Date.now() - groq20bStart}ms`);
            return { text, modelUsed: `Groq (${groqFallback})` };
          } catch (err: any) {
            console.warn(`[AI Evaluator] Groq Fallback (${groqFallback}) failed: ${err.message}.`);
          }
        }

        throw new Error('All configured AI providers (Gemini primary/fallback, Groq primary/fallback) failed.');
      },
      hasGemini ? `Gemini (${geminiPrimary})` : `Groq (${groqPrimary})`,
      15000
    );
  }

  const hybridEvaluator = new HybridEvaluator(ruleEvaluator, aiEvaluator);
  const app = createApp({ problemRepo, attemptRepo, evaluator: hybridEvaluator, userRepo });

  app.listen(port, () => {
    console.log(`[DesignDojo] Server running on http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[DesignDojo] Startup failed:', err.message);
  process.exit(1);
});
