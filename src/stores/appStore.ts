import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ViewName } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

function mapProject(r: any) {
  return { id: r.id, name: r.name, code: r.code || '', direction: r.direction || '', keywords: tryParseJson(r.keywords, []), description: r.description || '', leader: r.leader || '', startDate: r.start_date || '', endDate: r.end_date || '', status: r.status || '进行中', milestones: r.milestones || '', createdAt: r.created_at || '', updatedAt: r.updated_at || '' };
}
function mapExperiment(r: any) {
  return { id: r.id, projectId: r.project_id, title: r.title, type: r.type || '', date: r.date || '', purpose: r.purpose || '', materials: r.materials || '', steps: r.steps || '', parameters: r.parameters || '', results: r.results || '', conclusion: r.conclusion || '', issues: r.issues || '', nextSteps: r.next_steps || '', status: r.status || '待处理', contentFormat: r.content_format || 'plaintext', createdAt: r.created_at || '', updatedAt: r.updated_at || '' };
}
function mapResult(r: any) {
  return { id: r.id, experimentId: r.experiment_id || '', projectId: r.project_id || '', title: r.title, type: r.type || '', summary: r.summary || '', supportsHypothesis: r.supports_hypothesis === 1, version: r.version || 1, createdAt: r.created_at || '' };
}
function mapTask(r: any) {
  return { id: r.id, name: r.name, projectId: r.project_id || '', dueDate: r.due_date || '', priority: r.priority || '中', status: r.status || '待处理', assignee: r.assignee || '', notes: r.notes || '', createdAt: r.created_at || '' };
}
function mapReference(r: any) {
  return { id: r.id, title: r.title, doi: r.doi || '', pmid: r.pmid || '', authors: r.authors || '', year: r.year || 0, journal: r.journal || '', coreConclusion: r.core_conclusion || '', relation: r.relation || '', notes: r.notes || '', projectId: r.project_id || '', createdAt: r.created_at || '' };
}
function mapFile(r: any) {
  return { id: r.id, name: r.name, originalName: r.original_name || '', fileType: r.file_type || '', localPath: r.local_path || '', fileSize: r.file_size || 0, tags: tryParseJson(r.tags, []), createdAt: r.created_at || '' };
}
function mapTemplate(r: any) {
  return { id: r.id, name: r.name, category: r.category, icon: r.icon || '📋', fields: tryParseJson(r.fields, {}), isBuiltin: r.is_builtin === 1 };
}
function tryParseJson(s: any, fallback: any) {
  if (!s || typeof s !== 'string') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

interface AppState {
  loggedIn: boolean;
  currentUser: string;
  currentView: ViewName;
  selectedProjectId: string | null;
  selectedExperimentId: string | null;
  searchQuery: string;
  searchOpen: boolean;
  loading: boolean;

  projects: any[];
  experiments: any[];
  results: any[];
  files: any[];
  tasks: any[];
  references: any[];
  templates: any[];

  setLoggedIn: (user: string) => void;
  logout: () => void;

  navigateTo: (view: ViewName, opts?: { projectId?: string; experimentId?: string }) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;

  loadAll: () => Promise<void>;
  addProject: (data: any) => Promise<void>;
  updateProject: (id: string, data: any) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addExperiment: (data: any) => Promise<void>;
  deleteExperiment: (id: string) => Promise<void>;
  addResult: (data: any) => Promise<void>;
  deleteResult: (id: string) => Promise<void>;
  addTask: (data: any) => Promise<void>;
  updateTask: (id: string, data: any) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addReference: (data: any) => Promise<void>;
  deleteReference: (id: string) => Promise<void>;
  searchAll: (query: string) => Promise<any[]>;

  getProjectExperiments: (pid: string) => any[];
  getProjectResults: (pid: string) => any[];
  getProjectTasks: (pid: string) => any[];
  getProjectRefs: (pid: string) => any[];
  cloneExperiment: (id: string) => Promise<void>;
  getExperimentResults: (eid: string) => any[];
}

export const useStore = create<AppState>((set, get) => ({
  loggedIn: false, currentUser: '',
  currentView: 'dashboard', selectedProjectId: null, selectedExperimentId: null,
  searchQuery: '', searchOpen: false, loading: true,
  projects: [], experiments: [], results: [], files: [], tasks: [], references: [], templates: [],

  setLoggedIn: (user) => set({ loggedIn: true, currentUser: user }),
  logout: () => set({ loggedIn: false, currentUser: '', currentView: 'dashboard', projects: [], experiments: [], results: [], files: [], tasks: [], references: [] }),

  navigateTo: (view, opts) => set({
    currentView: view,
    ...(opts?.projectId !== undefined ? { selectedProjectId: opts.projectId } : {}),
    ...(opts?.experimentId !== undefined ? { selectedExperimentId: opts.experimentId } : {}),
  }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  loadAll: async () => {
    try {
      const [projects, experiments, results, tasks, refs, files, templates] = await Promise.all([
        invoke<any[]>('get_projects').catch(() => []),
        invoke<any[]>('get_experiments').catch(() => []),
        invoke<any[]>('get_results').catch(() => []),
        invoke<any[]>('get_tasks').catch(() => []),
        invoke<any[]>('get_references').catch(() => []),
        invoke<any[]>('get_files').catch(() => []),
        invoke<any[]>('get_templates').catch(() => []),
      ]);
      set({
        projects: projects.map(mapProject), experiments: experiments.map(mapExperiment),
        results: results.map(mapResult), tasks: tasks.map(mapTask),
        references: refs.map(mapReference), files: files.map(mapFile),
        templates: templates.map(mapTemplate), loading: false,
      });
    } catch (e) { console.error('加载失败:', e); set({ loading: false }); }
  },

  addProject: async (data) => {
    const id = generateId();
    const keywords = Array.isArray(data.keywords) ? data.keywords : (data.keywords || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    try {
      await invoke('create_project', { data: { id, name: data.name, code: data.code || '', direction: data.direction || '', keywords: JSON.stringify(keywords), description: data.description || '', leader: data.leader || '', start_date: data.startDate || '', end_date: data.endDate || '', status: data.status || '进行中', milestones: data.milestones || '' }});
      await get().loadAll();
    } catch (e: any) { alert('创建项目失败: ' + e); }
  },

  updateProject: async (id, data) => {
    const old = get().projects.find((p: any) => p.id === id);
    if (!old) return;
    const m = { ...old, ...data };
    try {
      await invoke('update_project', { id, name: m.name, code: m.code, direction: m.direction, keywords: JSON.stringify(Array.isArray(m.keywords) ? m.keywords : []), description: m.description, leader: m.leader, startDate: m.startDate, endDate: m.endDate, status: m.status, milestones: m.milestones });
      await get().loadAll();
    } catch (e: any) { console.error('更新项目失败:', e); }
  },

  deleteProject: async (id) => {
    try {
      await invoke('delete_project', { id });
      await get().loadAll();
      if (get().selectedProjectId === id) set({ selectedProjectId: null, currentView: 'projects' });
    } catch (e: any) { alert('删除项目失败: ' + e); }
  },

  addExperiment: async (data) => {
    const id = generateId();
    try {
      await invoke('create_experiment', { data: { id, project_id: data.projectId, title: data.title, type: data.type || '', date: data.date || '', purpose: data.purpose || '', materials: data.materials || '', steps: data.steps || '', parameters: data.parameters || '', results: data.results || '', conclusion: data.conclusion || '', issues: data.issues || '', next_steps: data.nextSteps || '', status: data.status || '待处理' }});
      await get().loadAll();
    } catch (e: any) { alert('创建实验失败: ' + e); }
  },

  deleteExperiment: async (id) => {
    try {
      await invoke('delete_experiment', { id });
      await get().loadAll();
      if (get().selectedExperimentId === id) set({ selectedExperimentId: null, currentView: 'experiments' });
    } catch (e: any) { alert('删除实验失败: ' + e); }
  },

  addResult: async (data) => {
    const id = generateId();
    try {
      await invoke('create_result', { id, experimentId: data.experimentId, projectId: data.projectId, title: data.title, type: data.type || '文本结论', summary: data.summary || '', supportsHypothesis: data.supportsHypothesis || false });
      await get().loadAll();
    } catch (e: any) { alert('添加结果失败: ' + e); }
  },

  deleteResult: async (id) => {
    try { await invoke('delete_result', { id }); await get().loadAll(); }
    catch (e: any) { alert('删除结果失败: ' + e); }
  },

  addTask: async (data) => {
    const id = generateId();
    try {
      await invoke('create_task', { id, name: data.name, projectId: data.projectId || '', dueDate: data.dueDate || '', priority: data.priority || '中', status: data.status || '待处理', assignee: data.assignee || '', notes: data.notes || '' });
      await get().loadAll();
    } catch (e: any) { console.error('创建任务失败:', e); }
  },

  updateTask: async (id, data) => {
    try { await invoke('update_task', { id, status: data.status }); await get().loadAll(); }
    catch (e: any) { console.error('更新任务失败:', e); }
  },

  deleteTask: async (id) => {
    try { await invoke('delete_task', { id }); await get().loadAll(); }
    catch (e: any) { console.error('删除任务失败:', e); }
  },

  addReference: async (data) => {
    const id = generateId();
    try {
      await invoke('create_reference', { id, title: data.title, doi: data.doi || '', authors: data.authors || '', year: data.year || 0, journal: data.journal || '', coreConclusion: data.coreConclusion || '', relation: data.relation || '', notes: data.notes || '', projectId: data.projectId || '' });
      await get().loadAll();
    } catch (e: any) { alert('添加文献失败: ' + e); }
  },

  deleteReference: async (id) => {
    try { await invoke('delete_reference', { id }); await get().loadAll(); }
    catch (e: any) { alert('删除文献失败: ' + e); }
  },

  searchAll: async (query) => {
    if (!query.trim()) return [];
    try { return await invoke<any[]>('search_all', { query }); }
    catch (e) { return []; }
  },

  cloneExperiment: async (id) => {
    const exp = get().experiments.find((e: any) => e.id === id);
    if (!exp) return;
    await get().addExperiment({ projectId: exp.projectId, title: exp.title + ' (副本)', type: exp.type, date: new Date().toISOString().slice(0, 10), purpose: exp.purpose, materials: exp.materials, steps: exp.steps, parameters: '', results: '', conclusion: '', issues: '', nextSteps: '', status: '进行中' } as any);
  },

  getProjectExperiments: (pid) => get().experiments.filter((e: any) => e.projectId === pid),
  getProjectResults: (pid) => get().results.filter((r: any) => r.projectId === pid),
  getProjectTasks: (pid) => get().tasks.filter((t: any) => t.projectId === pid),
  getProjectRefs: (pid) => get().references.filter((r: any) => r.projectId === pid),
  getExperimentResults: (eid) => get().results.filter((r: any) => r.experimentId === eid),
}));
