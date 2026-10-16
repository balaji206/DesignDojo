import { UserNav } from '../components/UserNav';
import { useAuth } from '../utils/AuthContext';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  CheckCircle2,
  Clock,
  Filter,
  Play,
  Search,
  Sparkles,
  Trophy,
  ArrowRight,
  History,
} from 'lucide-react';
import { api, getLearnerSessionId } from '../api/client';
import { PracticeAttempt, Problem } from '../types/domain';

export const Dashboard: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const handlePracticeClick = (e: React.MouseEvent, targetPath: string) => {
    e.preventDefault();
    if (!user) {
      sessionStorage.setItem('designdojo_target_problem', targetPath);
      openAuthModal('LOGIN', 'Please sign in or create an account to start practicing.');
      return;
    }
    navigate(targetPath);
  };
  const [problems, setProblems] = useState<Problem[]>([]);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [topicFilter, setTopicFilter] = useState<string>('ALL');

  useEffect(() => {
    Promise.all([api.getProblems(), api.getAllAttempts()])
      .then(([probData, attData]) => {
        setProblems(probData);
        setAttempts(attData);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const allTopics = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => p.topics.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [problems]);

  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchesDiff = difficultyFilter === 'ALL' || p.difficulty === difficultyFilter;
      const matchesTopic = topicFilter === 'ALL' || p.topics.includes(topicFilter);
      return matchesSearch && matchesDiff && matchesTopic;
    });
  }, [problems, search, difficultyFilter, topicFilter]);

  const stats = useMemo(() => {
    const attemptedCount = problems.filter((p) => (p.learnerStats?.attemptCount || 0) > 0).length;
    const completedCount = problems.filter((p) => p.learnerStats?.status === 'COMPLETED').length;
    const scoredAttempts = attempts.filter((a) => typeof a.report?.totalScore === 'number');
    const avgScore =
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce((acc, a) => acc + (a.report?.totalScore || 0), 0) /
              scoredAttempts.length
          )
        : null;
    return { attemptedCount, completedCount, avgScore };
  }, [problems, attempts]);

  const continueProblem = useMemo(() => {
    if (attempts.length === 0) return problems[0];
    const latestAttempt = attempts[0];
    return problems.find((p) => p.id === latestAttempt.problemId) || problems[0];
  }, [attempts, problems]);

  const diffColors: Record<string, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">DesignDojo</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                LLD Practice Studio
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs text-slate-400 font-mono">
              Session ID: <span className="text-slate-200">{getLearnerSessionId()}</span>
            </div>
            <UserNav />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-6 py-8 space-y-8 flex-1">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Attempted Problems</p>
              <p className="text-3xl font-bold mt-1 text-white">
                {stats.attemptedCount}{' '}
                <span className="text-sm font-normal text-slate-500">/ {problems.length}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Persisted learner session activity</p>
            </div>
            <Clock className="w-8 h-8 text-indigo-400 opacity-80" />
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Completed (Score ≥ 70)</p>
              <p className="text-3xl font-bold mt-1 text-emerald-400">
                {stats.completedCount}{' '}
                <span className="text-sm font-normal text-slate-500">/ {problems.length}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Verified by Hybrid Evaluator</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-80" />
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Average Design Score</p>
              <p className="text-3xl font-bold mt-1 text-amber-400">
                {stats.avgScore !== null ? `${stats.avgScore}/100` : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {attempts.length > 0
                  ? `Across ${attempts.length} persisted attempt(s)`
                  : 'No attempts submitted yet'}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-amber-400 opacity-80" />
          </div>
        </section>

        {continueProblem && (
          <section className="p-6 rounded-xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                <Sparkles className="w-4 h-4" />
                <span>{attempts.length > 0 ? 'CONTINUE PRACTICING' : 'RECOMMENDED FIRST CHALLENGE'}</span>
              </div>
              <h2 className="text-xl font-bold text-white">{continueProblem.title}</h2>
              <p className="text-sm text-slate-300 max-w-2xl line-clamp-2">
                {continueProblem.description}
              </p>
            </div>
            <Link
              to={`/problems/${continueProblem.slug}`}
              onClick={(e) => handlePracticeClick(e, `/problems/${continueProblem.slug}`)}
              className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-2 shrink-0 shadow-lg shadow-indigo-600/30 transition"
            >
              <Play className="w-4 h-4" />
              <span>Open Workspace</span>
            </Link>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search LLD problems..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                >
                  <option value="ALL">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                >
                  <option value="ALL">All Topics</option>
                  {allTopics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading problem library...</div>
            ) : (
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900/90">
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Problem</th>
                      <th className="py-3 px-4">Difficulty</th>
                      <th className="py-3 px-4">Latest Score</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-sm">
                    {filteredProblems.map((prob) => {
                      const status = prob.learnerStats?.status || 'NOT_STARTED';
                      return (
                        <tr key={prob.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                                status === 'COMPLETED'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : status === 'ATTEMPTED'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <Link
                              to={`/problems/${prob.slug}`}
                              onClick={(e) => handlePracticeClick(e, `/problems/${prob.slug}`)}
                              className="font-semibold text-slate-100 hover:text-indigo-400 transition"
                            >
                              {prob.title}
                            </Link>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {prob.topics.map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs px-2 py-0.5 rounded border ${
                                diffColors[prob.difficulty]
                              }`}
                            >
                              {prob.difficulty}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs">
                            {prob.learnerStats?.latestScore !== null &&
                            prob.learnerStats?.latestScore !== undefined ? (
                              <span className="text-slate-200 font-bold">
                                {prob.learnerStats.latestScore}/100
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Link
                              to={`/problems/${prob.slug}`}
                              onClick={(e) => handlePracticeClick(e, `/problems/${prob.slug}`)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                            >
                              <span>Practice</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Recent Persisted Attempts</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              {attempts.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No attempts recorded yet. Select a problem and submit your first class diagram!
                </p>
              ) : (
                attempts.slice(0, 6).map((att) => {
                  const prob = problems.find((p) => p.id === att.problemId);
                  return (
                    <Link
                      key={att.id}
                      to={`/problems/${prob?.slug || att.problemId}?attemptId=${att.id}`}
                      onClick={(e) => handlePracticeClick(e, `/problems/${prob?.slug || att.problemId}?attemptId=${att.id}`)}
                      className="block p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/40 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">
                          {prob?.title || att.problemId}
                        </span>
                        <span className="font-mono text-indigo-400">#{att.attemptNumber}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                        <span>{new Date(att.createdAt).toLocaleString()}</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {att.report ? `${att.report.totalScore}/100` : att.status}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
