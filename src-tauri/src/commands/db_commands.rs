use rusqlite::params;
use serde::Deserialize;
use std::sync::Mutex;
use tauri::State;

pub struct DbState(pub Mutex<rusqlite::Connection>);

type Row = serde_json::Map<String, serde_json::Value>;

fn rows_from_stmt(stmt: &mut rusqlite::Statement, p: &[&dyn rusqlite::types::ToSql]) -> Result<Vec<Row>, String> {
    let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt.query_map(p, |row| {
        let mut map = serde_json::Map::new();
        for (i, col) in cols.iter().enumerate() {
            let val: rusqlite::types::Value = row.get_unwrap(i);
            let jv = match val {
                rusqlite::types::Value::Null => serde_json::Value::Null,
                rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                rusqlite::types::Value::Real(f) => serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap()),
                rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                rusqlite::types::Value::Blob(b) => serde_json::Value::String(format!("[blob:{}bytes]", b.len())),
            };
            map.insert(col.clone(), jv);
        }
        Ok(map)
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ═══ Projects ═══

#[derive(Deserialize)]
pub struct NewProject {
    pub id: String, pub name: String, pub code: String, pub direction: String,
    pub keywords: String, pub description: String, pub leader: String,
    pub start_date: String, pub end_date: String, pub status: String, pub milestones: String,
}

#[tauri::command]
pub fn get_projects(db: State<DbState>) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY updated_at DESC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[])
}

#[tauri::command]
pub fn get_project(db: State<DbState>, id: String) -> Result<Option<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM projects WHERE id = ?1").map_err(|e| e.to_string())?;
    let rows = rows_from_stmt(&mut stmt, &[&id])?;
    Ok(rows.into_iter().next())
}

#[tauri::command]
pub fn create_project(db: State<DbState>, data: NewProject) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let st = format!("{} {} {} {} {}", data.name, data.description, data.direction, data.keywords, data.milestones);
    conn.execute(
        "INSERT INTO projects (id,name,code,direction,keywords,description,leader,start_date,end_date,status,milestones,searchable_text) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![data.id, data.name, data.code, data.direction, data.keywords, data.description, data.leader, data.start_date, data.end_date, data.status, data.milestones, st],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_project(db: State<DbState>, id: String, name: String, code: String, direction: String, keywords: String, description: String, leader: String, start_date: String, end_date: String, status: String, milestones: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let st = format!("{} {} {} {} {}", name, description, direction, keywords, milestones);
    conn.execute(
        "UPDATE projects SET name=?2,code=?3,direction=?4,keywords=?5,description=?6,leader=?7,start_date=?8,end_date=?9,status=?10,milestones=?11,searchable_text=?12 WHERE id=?1",
        params![id, name, code, direction, keywords, description, leader, start_date, end_date, status, milestones, st],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_project(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ Experiments ═══

#[derive(Deserialize)]
pub struct NewExperiment {
    pub id: String, pub project_id: String, pub title: String, pub r#type: String,
    pub date: String, pub purpose: String, pub materials: String, pub steps: String,
    pub parameters: String, pub results: String, pub conclusion: String,
    pub issues: String, pub next_steps: String, pub status: String,
}

#[tauri::command]
pub fn get_experiments(db: State<DbState>) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM experiments ORDER BY date DESC, created_at DESC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[])
}

#[tauri::command]
pub fn get_experiments_by_project(db: State<DbState>, project_id: String) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM experiments WHERE project_id = ?1 ORDER BY date DESC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[&project_id])
}

#[tauri::command]
pub fn create_experiment(db: State<DbState>, data: NewExperiment) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let st = format!("{} {} {} {} {} {} {}", data.title, data.purpose, data.results, data.conclusion, data.issues, data.materials, data.next_steps);
    conn.execute(
        "INSERT INTO experiments (id,project_id,title,type,date,purpose,materials,steps,parameters,results,conclusion,issues,next_steps,status,searchable_text) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
        params![data.id, data.project_id, data.title, data.r#type, data.date, data.purpose, data.materials, data.steps, data.parameters, data.results, data.conclusion, data.issues, data.next_steps, data.status, st],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_experiment(db: State<DbState>, id: String, title: String, r#type: String, date: String, purpose: String, materials: String, steps: String, parameters: String, results: String, conclusion: String, issues: String, next_steps: String, status: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let st = format!("{} {} {} {} {} {} {}", title, purpose, results, conclusion, issues, materials, next_steps);
    conn.execute(
        "UPDATE experiments SET title=?2,type=?3,date=?4,purpose=?5,materials=?6,steps=?7,parameters=?8,results=?9,conclusion=?10,issues=?11,next_steps=?12,status=?13,searchable_text=?14 WHERE id=?1",
        params![id, title, r#type, date, purpose, materials, steps, parameters, results, conclusion, issues, next_steps, status, st],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_experiment(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM experiments WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ Results ═══

#[tauri::command]
pub fn get_results(db: State<DbState>) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM results ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[])
}

#[tauri::command]
pub fn create_result(db: State<DbState>, id: String, experiment_id: String, project_id: String, title: String, r#type: String, summary: String, supports_hypothesis: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let st = format!("{} {}", title, summary);
    conn.execute(
        "INSERT INTO results (id,experiment_id,project_id,title,type,summary,supports_hypothesis,searchable_text) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![id, experiment_id, project_id, title, r#type, summary, supports_hypothesis as i32, st],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_result(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM results WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ Tasks ═══

#[tauri::command]
pub fn get_tasks(db: State<DbState>) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM tasks ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[])
}

#[tauri::command]
pub fn create_task(db: State<DbState>, id: String, name: String, project_id: String, due_date: String, priority: String, status: String, assignee: String, notes: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tasks (id,name,project_id,due_date,priority,status,assignee,notes) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![id, name, project_id, due_date, priority, status, assignee, notes],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_task(db: State<DbState>, id: String, status: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE tasks SET status=?2 WHERE id=?1", params![id, status]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_task(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ References ═══

#[tauri::command]
pub fn get_references(db: State<DbState>) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM references_table ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[])
}

#[tauri::command]
pub fn create_reference(db: State<DbState>, id: String, title: String, doi: String, authors: String, year: i32, journal: String, core_conclusion: String, relation: String, notes: String, project_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let st = format!("{} {} {} {}", title, core_conclusion, authors, notes);
    conn.execute(
        "INSERT INTO references_table (id,title,doi,authors,year,journal,core_conclusion,relation,notes,project_id,searchable_text) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        params![id, title, doi, authors, year, journal, core_conclusion, relation, notes, project_id, st],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_reference(db: State<DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM references_table WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ Files ═══

#[tauri::command]
pub fn get_files(db: State<DbState>) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM files WHERE is_deleted=0 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[])
}

// ═══ Templates ═══

#[tauri::command]
pub fn get_templates(db: State<DbState>) -> Result<Vec<Row>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT * FROM templates ORDER BY is_builtin DESC, name ASC").map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[])
}

// ═══ Search ═══

#[tauri::command]
pub fn search_all(db: State<DbState>, query: String) -> Result<Vec<Row>, String> {
    if query.trim().is_empty() { return Ok(vec![]); }
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let fts_query = format!("{}*", query.trim());
    let mut stmt = conn.prepare(
        "SELECT entity_type, entity_id, title, snippet(search_index, 3, '<b>', '</b>', '...', 32) as snippet FROM search_index WHERE search_index MATCH ?1 ORDER BY rank LIMIT 20"
    ).map_err(|e| e.to_string())?;
    rows_from_stmt(&mut stmt, &[&fts_query])
}

#[tauri::command]
pub async fn ai_parse_experiment(text: String, start_date: String) -> Result<String, String> {
    let api_key = "sk-47241bcb19fa4761930dc8174b5a1f14";
    let model = "deepseek-chat";

    let system_prompt = r#"你是一个专业的动物实验方案解析助手，专门帮助生物医学研究人员将实验描述转化为精确的时间轴步骤。

## 你的任务
将用户输入的实验描述（论文Methods、实验记录、protocol）解析为按天排列的实验步骤。

## 严格输出格式（仅返回JSON，不要任何其他文字）
{
  "experiment_name": "简洁实验名称（中文，15字以内）",
  "steps": [
    {
      "day": 0,
      "name": "步骤简称（中文，8字以内）",
      "description": "详细操作，保留所有参数",
      "repeat": null
    }
  ]
}

## 解析规则

### 时间识别（最重要）
- "Day 0" / "D0" / "第0天" → day: 0
- "Day 1" / "the next day" / "第二天" / "24h later" → day: 1
- "Day 3" / "after 3 days" / "3天后" / "72h later" → day: 3
- "Day 7" / "one week" / "一周后" → day: 7
- "Day 14" / "two weeks" / "两周后" → day: 14
- "Day 21" / "three weeks" → day: 21
- "Day -1" / "前一天" / "the day before" → day: -1（预处理步骤）
- 如果没有明确时间，根据上下文推断合理天数

### 重复操作识别
- "every 3 days" / "每3天" / "每隔3天" → repeat: 3
- "every other day" / "隔天" → repeat: 2
- "daily" / "每天" / "每日" → repeat: 1
- "twice a week" / "每周两次" → repeat: 3（约每3天）
- "weekly" / "每周" → repeat: 7
- 重复操作需要展开为独立步骤，直到实验结束

### 常见动物实验操作识别
- tumor implantation/inoculation/接种 → "肿瘤接种"
- irradiation/照射 → "放射治疗" + 剂量
- cell transfer/过继转输/adoptive transfer → "细胞过继" + 细胞数量和途径
- drug treatment/给药/administration → "药物治疗" + 药名+剂量+途径
- antibody injection/抗体注射 → "抗体治疗" + 抗体名+剂量
- tumor measurement/测量/monitor → "肿瘤测量"
- blood collection/采血 → "采血检测"
- sacrifice/处死/euthanasia → "取材处死"
- tissue harvest/取材 → "组织取材"
- flow cytometry/流式 → "流式检测"
- ELISA → "ELISA检测"
- imaging/成像 → "活体成像"
- weigh/称重 → "体重记录"
- survival/生存 → "生存观察"

### 参数保留
description 中必须保留：
- 细胞数量：1×10^6, 5×10^5
- 药物剂量：200μg, 10mg/kg, 6mg/kg
- 给药途径：i.v.(静脉), i.p.(腹腔), s.c.(皮下), i.t.(瘤内), p.o.(口服)
- 照射剂量：5Gy, 2Gy×5
- 体积/浓度：100μL, 1mg/mL
- 肿瘤细胞系：B16, MC38, 4T1, CT26, LLC, EL4

### 重复步骤展开规则
如果描述说"aPD-L1 every 3 days from Day 3"且实验总周期约21天：
→ 生成 Day3, Day6, Day9, Day12, Day15, Day18 各一个步骤
每个步骤的 name 相同，description 标注"第X次给药"

如果描述说"tumor measurement every other day from Day 7"：
→ 生成 Day7, Day9, Day11, Day13... 直到实验结束

### 实验名称生成
从文本中提取：
- 治疗方案：如"ACT联合aPD-L1"
- 肿瘤模型：如"B16-OVA"
- 合成为："ACT联合aPD-L1治疗B16-OVA模型"

## 示例

重要判断示例：
- "Western blot检测p-STAT3" → display_mode: "steps"（1-2天内完成，步骤顺序展示）
- "B16荷瘤小鼠联合治疗" → display_mode: "timeline"（多天实验，按天展示）
- "RNA-seq差异分析" → display_mode: "checklist"（计算任务，清单展示）
- "qPCR检测基因表达" → display_mode: "steps"
- "流式检测T细胞亚群" → display_mode: "steps"
- "免疫组化染色" → display_mode: "steps"
- "单细胞测序分析" → display_mode: "checklist"

输入：
B16-OVA cells (2×10^5) were implanted s.c. into C57BL/6 mice. On day 5, mice received 5Gy irradiation. On day 6, 1×10^6 OT-I T cells were transferred i.v. Starting from day 8, mice were treated with anti-PD-L1 (200μg, i.p.) every 3 days for 4 doses. Tumor size was measured every other day starting from day 7. Mice were sacrificed on day 25.

输出：
{
  "experiment_name": "放疗联合OT-I和aPD-L1治疗B16-OVA",
  "steps": [
    {"day": 0, "name": "肿瘤接种", "description": "B16-OVA 2×10^5 皮下接种 C57BL/6小鼠", "repeat": null},
    {"day": 5, "name": "放射治疗", "description": "局部照射 5Gy", "repeat": null},
    {"day": 6, "name": "T细胞过继", "description": "OT-I T细胞 1×10^6 静脉注射(i.v.)", "repeat": null},
    {"day": 7, "name": "肿瘤测量", "description": "测量肿瘤大小，隔天测量", "repeat": null},
    {"day": 8, "name": "aPD-L1治疗", "description": "anti-PD-L1 200μg 腹腔注射(i.p.) 第1次", "repeat": null},
    {"day": 9, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 11, "name": "aPD-L1治疗", "description": "anti-PD-L1 200μg i.p. 第2次", "repeat": null},
    {"day": 11, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 13, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 14, "name": "aPD-L1治疗", "description": "anti-PD-L1 200μg i.p. 第3次", "repeat": null},
    {"day": 15, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 17, "name": "aPD-L1治疗", "description": "anti-PD-L1 200μg i.p. 第4次（末次）", "repeat": null},
    {"day": 17, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 19, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 21, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 23, "name": "肿瘤测量", "description": "测量肿瘤大小", "repeat": null},
    {"day": 25, "name": "取材处死", "description": "处死小鼠，收集肿瘤和脾脏组织", "repeat": null}
  ]
}

注意：重复步骤必须全部展开为独立步骤，这样用户每天打开APP就能看到当天具体要做什么。"#;

    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": format!("起始日期: {}\n\n实验描述:\n{}", start_date, text) }
        ],
        "temperature": 0.05,
        "max_tokens": 4096
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.deepseek.com/chat/completions")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("API错误 {}: {}", status, &err_text[..err_text.len().min(200)]));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| format!("解析响应失败: {}", e))?;
    
    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("AI返回内容为空")?;

    let cleaned = content
        .replace("```json", "")
        .replace("```", "")
        .trim()
        .to_string();

    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&cleaned)
        .map_err(|e| format!("AI返回格式错误: {}", e))?;

    Ok(cleaned)
}
