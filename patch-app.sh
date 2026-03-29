#!/bin/bash
# Patch App.tsx to use FileUploadZone instead of NewResultModal

cd ~/Desktop/biolab

# 1. Add FileUploadZone import
sed -i '' "s|import './App.css';|import './App.css';\nimport { FileUploadZone } from './components/FileUploadZone';|" src/App.tsx

# 2. Replace the ExperimentDetail component
# We need to replace from "function ExperimentDetail()" to the closing of that function
# This is complex with sed, so we use a Python script

python3 << 'PYEOF'
import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Find and replace the ExperimentDetail function
old_detail = '''// ═══ Experiment Detail ═══
function ExperimentDetail() {
  const { selectedExperimentId, experiments, projects, results, navigateTo, deleteExperiment, deleteResult } = useStore();
  const [showNewResult, setShowNewResult] = useState(false);
  const exp = experiments.find(e => e.id === selectedExperimentId);
  if (!exp) return null;
  const proj = projects.find(p => p.id === exp.projectId);
  const expResults = results.filter(r => r.experimentId === exp.id);
  const Section = ({ title, content }: { title: string; content?: string }) => { if (!content) return null; return <div className="detail-section"><h4>{title}</h4><pre>{content}</pre></div>; };
  return (
    <div>
      <div className="back-nav">
        <span className="back-btn" onClick={() => proj ? navigateTo('projectDetail', { projectId: proj.id }) : navigateTo('experiments')}><ArrowLeft size={18} /></span>
        <div className="flex-1">{proj && <div className="flex items-center gap-2 mb-2"><span className="breadcrumb" onClick={() => navigateTo('projectDetail', { projectId: proj.id })}>{proj.name}</span><ChevronRight size={14} color="#d1d5db" /></div>}<h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{exp.title}</h1><div className="flex items-center gap-3"><Badge>{exp.status}</Badge><span className="muted text-sm"><Calendar size={14} /> {formatDate(exp.date)} · {exp.type}</span></div></div>
        <button className="btn" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => { if (confirm(`删除实验"${exp.title}"？`)) deleteExperiment(exp.id); }}><Trash2 size={16} /> 删除</button>
      </div>
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card"><Section title="实验目的" content={exp.purpose} /><Section title="样本/材料" content={exp.materials} /><Section title="实验步骤" content={exp.steps} /><Section title="关键参数" content={exp.parameters} /><Section title="实验结果" content={exp.results} /><Section title="初步结论" content={exp.conclusion} /><Section title="问题与异常" content={exp.issues} /><Section title="下一步计划" content={exp.nextSteps} /></div>
        <div>
          <div className="card">
            <div className="flex justify-between items-center" style={{ marginBottom: 8 }}><h3 style={{ fontWeight: 600, fontSize: 14 }}>实验结果 ({expResults.length})</h3><button className="btn sm primary" onClick={() => setShowNewResult(true)}><Plus size={14} /> 添加</button></div>
            {expResults.map(r => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f3f5' }}>
                <div className="flex justify-between items-center"><span className="text-sm font-bold">{r.title}</span><div className="flex items-center gap-2"><span style={{ fontSize: 11, color: r.supportsHypothesis ? '#059669' : '#dc2626' }}>{r.supportsHypothesis ? '✓ 支持' : '✗ 不支持'}</span><Trash2 size={13} style={{ cursor: 'pointer', color: '#d1d5db' }} onClick={() => { if (confirm('删除此结果？')) deleteResult(r.id); }} /></div></div>
                <div className="text-xs muted">{r.summary}</div><span className="tag" style={{ fontSize: 10 }}>{r.type}</span>
              </div>
            ))}
            {expResults.length === 0 && <div className="text-sm muted">点击上方"添加"按钮录入实验结果</div>}
          </div>
        </div>
      </div>
      {showNewResult && <NewResultModal onClose={() => setShowNewResult(false)} experimentId={exp.id} projectId={exp.projectId} />}
    </div>
  );
}'''

new_detail = '''// ═══ Experiment Detail ═══
function ExperimentDetail() {
  const { selectedExperimentId, experiments, projects, navigateTo, deleteExperiment } = useStore();
  const [expFiles, setExpFiles] = useState<any[]>([]);
  const exp = experiments.find(e => e.id === selectedExperimentId);

  const loadFiles = useCallback(async () => {
    if (!exp) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<any[]>('get_experiment_files', { experimentId: exp.id });
      setExpFiles(files);
    } catch (e) { console.error('加载文件失败:', e); }
  }, [exp?.id]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  if (!exp) return null;
  const proj = projects.find(p => p.id === exp.projectId);
  const Section = ({ title, content }: { title: string; content?: string }) => { if (!content) return null; return <div className="detail-section"><h4>{title}</h4><pre>{content}</pre></div>; };
  return (
    <div>
      <div className="back-nav">
        <span className="back-btn" onClick={() => proj ? navigateTo('projectDetail', { projectId: proj.id }) : navigateTo('experiments')}><ArrowLeft size={18} /></span>
        <div className="flex-1">{proj && <div className="flex items-center gap-2 mb-2"><span className="breadcrumb" onClick={() => navigateTo('projectDetail', { projectId: proj.id })}>{proj.name}</span><ChevronRight size={14} color="#d1d5db" /></div>}<h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{exp.title}</h1><div className="flex items-center gap-3"><Badge>{exp.status}</Badge><span className="muted text-sm"><Calendar size={14} /> {formatDate(exp.date)} · {exp.type}</span></div></div>
        <button className="btn" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => { if (confirm(`删除实验"${exp.title}"？`)) deleteExperiment(exp.id); }}><Trash2 size={16} /> 删除</button>
      </div>
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card"><Section title="实验目的" content={exp.purpose} /><Section title="样本/材料" content={exp.materials} /><Section title="实验步骤" content={exp.steps} /><Section title="关键参数" content={exp.parameters} /><Section title="实验结果" content={exp.results} /><Section title="初步结论" content={exp.conclusion} /><Section title="问题与异常" content={exp.issues} /><Section title="下一步计划" content={exp.nextSteps} /></div>
        <div>
          <div className="card">
            <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>实验附件 ({expFiles.length})</h3>
            <FileUploadZone experimentId={exp.id} projectId={exp.projectId} files={expFiles} onFilesChanged={loadFiles} />
          </div>
        </div>
      </div>
    </div>
  );
}'''

if old_detail in content:
    content = content.replace(old_detail, new_detail)
    print("ExperimentDetail replaced successfully")
else:
    print("WARNING: Could not find ExperimentDetail to replace")
    print("Trying alternate approach...")
    # Try to find just the function start
    idx = content.find('function ExperimentDetail()')
    if idx > 0:
        print(f"Found ExperimentDetail at position {idx}")
    else:
        print("ExperimentDetail not found at all!")

# Also need to add useCallback to imports
if 'useCallback' not in content:
    content = content.replace(
        "import { useState, useEffect, useRef, useMemo }",
        "import { useState, useEffect, useRef, useMemo, useCallback }"
    )
    print("Added useCallback import")

with open('src/App.tsx', 'w') as f:
    f.write(content)

print("Done!")
PYEOF

echo "Patch complete"
