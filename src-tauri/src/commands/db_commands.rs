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
