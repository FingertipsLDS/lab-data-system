export interface Project {
  id: string;
  name: string;
  code: string;
  direction: string;
  keywords: string[];
  description: string;
  leader: string;
  startDate: string;
  endDate: string;
  status: '进行中' | '暂停' | '已完成';
  milestones: string;
  createdAt: string;
  updatedAt: string;
}

export interface Experiment {
  id: string;
  projectId: string;
  planId?: string;
  title: string;
  type: string;
  date: string;
  purpose: string;
  materials: string;
  steps: string;
  parameters: string;
  results: string;
  conclusion: string;
  issues: string;
  nextSteps: string;
  status: '待处理' | '进行中' | '成功' | '失败' | '待复验';
  contentFormat: 'plaintext' | 'tiptap_json';
  createdAt: string;
  updatedAt: string;
}

export interface Result {
  id: string;
  experimentId: string;
  projectId: string;
  title: string;
  type: '图片' | '图表' | '统计结果' | '文本结论';
  summary: string;
  supportsHypothesis: boolean;
  version: number;
  createdAt: string;
}

export interface FileRecord {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  localPath: string;
  fileSize: number;
  tags: string[];
  createdAt: string;
}

export interface EntityFile {
  fileId: string;
  entityType: string;
  entityId: string;
  role: string;
  sortOrder: number;
  label: string;
}

export interface Task {
  id: string;
  name: string;
  projectId: string;
  dueDate: string;
  priority: '高' | '中' | '低';
  status: '待处理' | '进行中' | '已完成';
  assignee: string;
  notes: string;
  createdAt: string;
}

export interface Reference {
  id: string;
  title: string;
  doi: string;
  pmid: string;
  authors: string;
  year: number;
  journal: string;
  coreConclusion: string;
  relation: string;
  notes: string;
  projectId: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  icon: string;
  fields: Record<string, string>;
  isBuiltin: boolean;
}

export type ViewName = 'dashboard' | 'projects' | 'projectDetail' | 'experiments' | 'experimentDetail' | 'files' | 'references' | 'templates' | 'tasks' | 'settings';
