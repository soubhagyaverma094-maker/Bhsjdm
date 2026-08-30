'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppNav from '../../AppNav';
import { createClient } from '../../../lib/supabase';

interface Task {
  id: string;
  title: string;
  task_type: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  monthly_value: number | null;
}

const COLUMNS: { key: Task['status']; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'internal_review', label: 'Internal review' },
  { key: 'client_review', label: 'Client review' },
  { key: 'revision', label: 'Revision' },
  { key: 'approved', label: 'Approved' },
  { key: 'published', label: 'Published' },
];

export default function ProjectDetail() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (cancelled) return;
      if (uErr || !u.user) { router.replace('/login'); return; }
      const [{ data: p, error: pErr }, { data: t, error: tErr }] = await Promise.all([
        supabase.from('projects').select('id, name, status, monthly_value').eq('id', params.id).maybeSingle(),
        supabase.from('project_tasks').select('*').eq('project_id', params.id).order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      if (pErr) setErr(pErr.message);
      else if (tErr) setErr(tErr.message);
      setProject(p as Project | null);
      setTasks((t ?? []) as Task[]);
    })();
    return () => { cancelled = true; };
  }, [params.id, router, supabase]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const { data } = await supabase.from('project_tasks').insert({
      project_id: params.id,
      title: newTitle.trim(),
    }).select('*').single();
    if (data) setTasks((prev) => [...prev, data as Task]);
    setNewTitle('');
  }

  async function moveTask(id: string, status: Task['status']) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    await supabase.from('project_tasks').update({ status }).eq('id', id);
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="px-5 py-4">
        <button onClick={() => router.push('/projects')} className="text-xs text-[var(--text-muted)] mb-2">
          ← All projects
        </button>
        <h2 className="font-serif text-2xl">{project?.name ?? 'Loading…'}</h2>
        {project && (
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {project.status}{project.monthly_value ? ` · ₹${project.monthly_value.toLocaleString('en-IN')}/mo` : ''}
          </p>
        )}
      </div>

      <form onSubmit={addTask} className="px-5 pb-4 flex gap-2">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 h-10 px-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg text-sm" />
        <button type="submit"
          className="h-10 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--surface-2)] text-sm">
          Add
        </button>
      </form>

      {err && (
        <div className="mx-5 mb-4 glass p-4">
          <p className="text-sm text-[#FF9AA6] font-medium">Something broke</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono break-all">{err}</p>
          {/relation.*does not exist|schema cache/i.test(err) && (
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              Run <code>05_projects_tasks_invoices.sql</code> in Supabase to create
              the projects &amp; project_tasks tables.
            </p>
          )}
        </div>
      )}

      <main className="px-5 pb-12 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {COLUMNS.map((c) => {
            const col = tasks.filter((t) => t.status === c.key);
            return (
              <div key={c.key} className="w-64 shrink-0">
                <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2 px-1">
                  {c.label} <span className="opacity-60">{col.length}</span>
                </div>
                <ul className="space-y-2">
                  {col.map((t) => (
                    <li key={t.id}
                      className="bg-[var(--surface-1)] border border-[var(--border-strong)] rounded-lg p-3">
                      <p className="text-sm">{t.title}</p>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">
                        {t.task_type} · {t.due_date || 'no due date'}
                      </div>
                      <select
                        value={t.status}
                        onChange={(e) => moveTask(t.id, e.target.value as Task['status'])}
                        className="mt-2 w-full text-[11px] h-7 bg-transparent border border-[var(--border-strong)] rounded"
                      >
                        {COLUMNS.map((cc) => <option key={cc.key} value={cc.key}>{cc.label}</option>)}
                        <option value="done">Done</option>
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
