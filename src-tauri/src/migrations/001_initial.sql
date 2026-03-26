PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '0');
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, direction TEXT,
    keywords TEXT, description TEXT, leader TEXT, start_date TEXT, end_date TEXT,
    status TEXT DEFAULT '进行中' CHECK(status IN ('进行中','暂停','已完成')),
    milestones TEXT, is_locked INTEGER DEFAULT 0, searchable_text TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, time_range TEXT, goal TEXT, key_tasks TEXT, expected TEXT,
    risks TEXT, priority TEXT DEFAULT '中' CHECK(priority IN ('高','中','低')),
    progress INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
    title TEXT NOT NULL, type TEXT, date TEXT, purpose TEXT, materials TEXT,
    steps TEXT, parameters TEXT, results TEXT, conclusion TEXT, issues TEXT,
    next_steps TEXT, status TEXT DEFAULT '待处理'
      CHECK(status IN ('待处理','进行中','成功','失败','待复验')),
    content_format TEXT DEFAULT 'plaintext', searchable_text TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS samples (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT,
    type TEXT CHECK(type IN ('细胞','动物','组织','血液','试剂','其他')),
    source TEXT, batch_no TEXT, status TEXT DEFAULT '可用'
      CHECK(status IN ('可用','已用完','已过期')),
    notes TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY, experiment_id TEXT REFERENCES experiments(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL, type TEXT CHECK(type IN ('图片','图表','统计结果','文本结论')),
    summary TEXT, supports_hypothesis INTEGER DEFAULT 0, version INTEGER DEFAULT 1,
    searchable_text TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, original_name TEXT, file_type TEXT,
    local_path TEXT NOT NULL, file_size INTEGER, mime_type TEXT, hash_sha256 TEXT,
    tags TEXT, thumbnail_path TEXT, is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS entity_files (
    id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
    role TEXT DEFAULT 'attachment', sort_order INTEGER DEFAULT 0, label TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(file_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS references_table (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, doi TEXT, pmid TEXT, authors TEXT,
    year INTEGER, journal TEXT, core_conclusion TEXT, relation TEXT, notes TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    pdf_file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
    searchable_text TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    plan_id TEXT REFERENCES plans(id) ON DELETE SET NULL,
    experiment_id TEXT REFERENCES experiments(id) ON DELETE SET NULL,
    due_date TEXT, priority TEXT DEFAULT '中' CHECK(priority IN ('高','中','低')),
    status TEXT DEFAULT '待处理' CHECK(status IN ('待处理','进行中','已完成')),
    assignee TEXT, notes TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
    target_type TEXT NOT NULL, target_id TEXT NOT NULL, relation TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(source_type, source_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS experiment_samples (
    experiment_id TEXT REFERENCES experiments(id) ON DELETE CASCADE,
    sample_id TEXT REFERENCES samples(id) ON DELETE CASCADE,
    usage_amount TEXT, notes TEXT, PRIMARY KEY (experiment_id, sample_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('create','update','delete','restore')),
    changes TEXT, operator TEXT DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL, version INTEGER NOT NULL, snapshot TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, icon TEXT,
    fields TEXT NOT NULL, is_builtin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_type, entity_id UNINDEXED, title, content, tags, tokenize='unicode61'
);

CREATE INDEX IF NOT EXISTS idx_exp_project ON experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_exp_date ON experiments(date DESC);
CREATE INDEX IF NOT EXISTS idx_results_exp ON results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_results_proj ON results(project_id);
CREATE INDEX IF NOT EXISTS idx_ef_file ON entity_files(file_id);
CREATE INDEX IF NOT EXISTS idx_ef_entity ON entity_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_audit ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_versions ON versions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_src ON relations(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rel_tgt ON relations(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash_sha256);

CREATE TRIGGER IF NOT EXISTS trg_projects_updated AFTER UPDATE ON projects
BEGIN UPDATE projects SET updated_at = datetime('now','localtime') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_experiments_updated AFTER UPDATE ON experiments
BEGIN UPDATE experiments SET updated_at = datetime('now','localtime') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_results_updated AFTER UPDATE ON results
BEGIN UPDATE results SET updated_at = datetime('now','localtime') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_tasks_updated AFTER UPDATE ON tasks
BEGIN UPDATE tasks SET updated_at = datetime('now','localtime') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_si_proj_i AFTER INSERT ON projects BEGIN
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('project',NEW.id,NEW.name,NEW.searchable_text,COALESCE(NEW.keywords,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_proj_u AFTER UPDATE ON projects BEGIN
    DELETE FROM search_index WHERE entity_type='project' AND entity_id=OLD.id;
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('project',NEW.id,NEW.name,NEW.searchable_text,COALESCE(NEW.keywords,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_proj_d AFTER DELETE ON projects BEGIN
    DELETE FROM search_index WHERE entity_type='project' AND entity_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trg_si_exp_i AFTER INSERT ON experiments BEGIN
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('experiment',NEW.id,NEW.title,NEW.searchable_text,COALESCE(NEW.type,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_exp_u AFTER UPDATE ON experiments BEGIN
    DELETE FROM search_index WHERE entity_type='experiment' AND entity_id=OLD.id;
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('experiment',NEW.id,NEW.title,NEW.searchable_text,COALESCE(NEW.type,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_exp_d AFTER DELETE ON experiments BEGIN
    DELETE FROM search_index WHERE entity_type='experiment' AND entity_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trg_si_res_i AFTER INSERT ON results BEGIN
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('result',NEW.id,NEW.title,NEW.searchable_text,COALESCE(NEW.type,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_res_u AFTER UPDATE ON results BEGIN
    DELETE FROM search_index WHERE entity_type='result' AND entity_id=OLD.id;
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('result',NEW.id,NEW.title,NEW.searchable_text,COALESCE(NEW.type,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_res_d AFTER DELETE ON results BEGIN
    DELETE FROM search_index WHERE entity_type='result' AND entity_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trg_si_file_i AFTER INSERT ON files BEGIN
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('file',NEW.id,NEW.name,COALESCE(NEW.original_name,''),COALESCE(NEW.tags,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_file_u AFTER UPDATE ON files WHEN NEW.is_deleted=0 BEGIN
    DELETE FROM search_index WHERE entity_type='file' AND entity_id=OLD.id;
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('file',NEW.id,NEW.name,COALESCE(NEW.original_name,''),COALESCE(NEW.tags,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_file_sd AFTER UPDATE ON files WHEN NEW.is_deleted=1 BEGIN
    DELETE FROM search_index WHERE entity_type='file' AND entity_id=OLD.id; END;
CREATE TRIGGER IF NOT EXISTS trg_si_file_d AFTER DELETE ON files BEGIN
    DELETE FROM search_index WHERE entity_type='file' AND entity_id=OLD.id; END;

CREATE TRIGGER IF NOT EXISTS trg_si_ref_i AFTER INSERT ON references_table BEGIN
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('reference',NEW.id,NEW.title,NEW.searchable_text,COALESCE(NEW.journal,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_ref_u AFTER UPDATE ON references_table BEGIN
    DELETE FROM search_index WHERE entity_type='reference' AND entity_id=OLD.id;
    INSERT INTO search_index (entity_type,entity_id,title,content,tags)
    VALUES ('reference',NEW.id,NEW.title,NEW.searchable_text,COALESCE(NEW.journal,'')); END;
CREATE TRIGGER IF NOT EXISTS trg_si_ref_d AFTER DELETE ON references_table BEGIN
    DELETE FROM search_index WHERE entity_type='reference' AND entity_id=OLD.id; END;

INSERT OR IGNORE INTO templates (id,name,category,icon,fields,is_builtin) VALUES
('tpl_cell','细胞实验','experiment','🧫','{"type":"细胞实验","steps":"1. 细胞培养与传代\n2. 处理/转染\n3. 培养与观察\n4. 收样\n5. 检测与分析","materials":"细胞系: \n培养基: \n血清: \n处理药物: "}',1),
('tpl_animal','动物实验','experiment','🐁','{"type":"动物实验","steps":"1. 动物分组\n2. 给药/处理\n3. 观察与记录\n4. 取材\n5. 检测分析","materials":"动物品系: \n周龄: \n性别: \n分组方案: "}',1),
('tpl_flow','流式实验','experiment','🔬','{"type":"流式实验","steps":"1. 样本制备\n2. 表面染色\n3. 固定破膜\n4. 胞内染色\n5. 上机检测\n6. 数据分析","materials":"抗体Panel: \n固定液: \n破膜液: \n缓冲液: "}',1),
('tpl_molecular','分子实验','experiment','🧬','{"type":"分子实验","steps":"1. 核酸/蛋白提取\n2. 定量\n3. 电泳/PCR/WB\n4. 成像\n5. 数据分析","materials":"样本类型: \n提取试剂盒: \n引物/抗体: "}',1),
('tpl_proteomics','蛋白组学分析','experiment','📊','{"type":"蛋白组学分析","steps":"1. 样本准备\n2. 蛋白提取与酶解\n3. 质谱上样\n4. 数据采集\n5. 生信分析","materials":"样本类型: \n酶解方案: \n质谱平台: "}',1),
('tpl_staining','免疫染色实验','experiment','🎨','{"type":"免疫染色","steps":"1. 切片/爬片准备\n2. 抗原修复\n3. 封闭\n4. 一抗孵育\n5. 二抗孵育\n6. 显色/荧光\n7. 封片与拍照","materials":"一抗: \n二抗: \n封闭液: \n显色液: "}',1);
