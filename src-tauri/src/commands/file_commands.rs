use crate::commands::db_commands::DbState;
use rusqlite::params;
use tauri::{Manager, State};
use std::path::Path;
use std::fs;

#[tauri::command]
pub async fn import_files_to_experiment(
    app: tauri::AppHandle,
    db: State<'_, DbState>,
    experiment_id: String,
    project_id: String,
    file_paths: Vec<String>,
) -> Result<Vec<String>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let files_dir = data_dir.join("files");
    fs::create_dir_all(&files_dir).map_err(|e| e.to_string())?;

    let mut imported_ids = Vec::new();

    for path_str in &file_paths {
        let src = Path::new(path_str);
        if !src.exists() { continue; }

        let original_name = src.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let ext = src.extension()
            .map(|e| e.to_string_lossy().to_string().to_lowercase())
            .unwrap_or_default();

        let file_size = src.metadata().map(|m| m.len() as i64).unwrap_or(0);
        let id = format!("f{}{}", chrono::Local::now().format("%Y%m%d%H%M%S"), rand::random::<u16>());

        // 复制文件到 data/files/ 目录
        let dest_name = format!("{}.{}", id, ext);
        let dest_path = files_dir.join(&dest_name);
        fs::copy(src, &dest_path).map_err(|e| format!("复制文件失败: {}", e))?;

        let local_path = format!("files/{}", dest_name);

        // 写入 files 表
        {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO files (id, name, original_name, file_type, local_path, file_size, tags) VALUES (?1,?2,?3,?4,?5,?6,'[]')",
                params![id, original_name, original_name, ext, local_path, file_size],
            ).map_err(|e| e.to_string())?;

            // 关联到实验
            let link_id = format!("ef{}{}", chrono::Local::now().format("%H%M%S"), rand::random::<u16>());
            conn.execute(
                "INSERT OR IGNORE INTO entity_files (id, file_id, entity_type, entity_id, role) VALUES (?1,?2,'experiment',?3,'attachment')",
                params![link_id, id, experiment_id],
            ).map_err(|e| e.to_string())?;

            // 也关联到项目
            let link_id2 = format!("ef{}{}", chrono::Local::now().format("%H%M%S"), rand::random::<u16>() + 1);
            conn.execute(
                "INSERT OR IGNORE INTO entity_files (id, file_id, entity_type, entity_id, role) VALUES (?1,?2,'project',?3,'attachment')",
                params![link_id2, id, project_id],
            ).map_err(|e| e.to_string())?;
        }

        imported_ids.push(id);
    }

    Ok(imported_ids)
}

#[tauri::command]
pub fn get_experiment_files(db: State<DbState>, experiment_id: String) -> Result<Vec<serde_json::Map<String, serde_json::Value>>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT f.*, ef.role, ef.label FROM files f JOIN entity_files ef ON f.id = ef.file_id WHERE ef.entity_type = 'experiment' AND ef.entity_id = ?1 AND f.is_deleted = 0 ORDER BY f.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt.query_map(params![experiment_id], |row| {
        let mut map = serde_json::Map::new();
        for (i, col) in cols.iter().enumerate() {
            let val: rusqlite::types::Value = row.get_unwrap(i);
            let jv = match val {
                rusqlite::types::Value::Null => serde_json::Value::Null,
                rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                rusqlite::types::Value::Real(f) => serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap()),
                rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                rusqlite::types::Value::Blob(b) => serde_json::Value::String(format!("[blob:{}]", b.len())),
            };
            map.insert(col.clone(), jv);
        }
        Ok(map)
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_experiment_file(db: State<DbState>, file_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // 软删除文件
    conn.execute("UPDATE files SET is_deleted = 1 WHERE id = ?1", params![file_id])
        .map_err(|e| e.to_string())?;
    // 删除关联
    conn.execute("DELETE FROM entity_files WHERE file_id = ?1", params![file_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// 用系统默认程序打开文件
#[tauri::command]
pub async fn open_file(app: tauri::AppHandle, local_path: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let full_path = data_dir.join(&local_path);
    open::that(&full_path).map_err(|e| format!("无法打开文件: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn read_file_base64(local_path: String, data_dir: tauri::State<crate::DbState>) -> Result<String, String> {
    use std::fs;
    use std::path::{Path, PathBuf};
    use base64::Engine;
    
    let path: PathBuf = if Path::new(&local_path).is_absolute() {
        PathBuf::from(&local_path)
    } else {
        let conn = data_dir.0.lock().map_err(|e| e.to_string())?;
        let db_p: String = conn.path().unwrap_or("").to_string();
        let parent = Path::new(&db_p).parent().unwrap_or(Path::new("."));
        parent.join(&local_path)
    };
    
    let bytes = fs::read(&path).map_err(|e| format!("{}: {}", path.display(), e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    };
    
    Ok(format!("data:{};base64,{}", mime, b64))
}
