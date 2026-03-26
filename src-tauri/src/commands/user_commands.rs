use crate::commands::db_commands::DbState;
use rusqlite::params;
use serde::Deserialize;
use tauri::State;

#[tauri::command]
pub fn check_has_users(db: State<DbState>) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let count: i64 = conn.query_row("SELECT count(*) FROM users", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(count > 0)
}

#[tauri::command]
pub fn get_user_list(db: State<DbState>) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT username FROM users ORDER BY last_login_at DESC")
        .map_err(|e| e.to_string())?;
    let names = stmt.query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(names)
}

#[tauri::command]
pub fn register_user(db: State<DbState>, username: String, password: String, display_name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // 检查用户名是否已存在
    let exists: bool = conn.query_row(
        "SELECT count(*) > 0 FROM users WHERE username = ?1",
        params![username], |r| r.get(0)
    ).map_err(|e| e.to_string())?;

    if exists {
        return Err("该用户名已存在".to_string());
    }

    let hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
    let id = format!("u{}{}", chrono::Local::now().format("%Y%m%d%H%M%S"), rand::random::<u16>());

    conn.execute(
        "INSERT INTO users (id, username, display_name, password_hash) VALUES (?1, ?2, ?3, ?4)",
        params![id, username, display_name, hash],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn login_user(db: State<DbState>, username: String, password: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let result: Result<(String, String), _> = conn.query_row(
        "SELECT id, password_hash FROM users WHERE username = ?1",
        params![username],
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
    );

    match result {
        Ok((user_id, hash)) => {
            let valid = bcrypt::verify(&password, &hash).map_err(|e| e.to_string())?;
            if valid {
                // 更新最后登录时间
                conn.execute(
                    "UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?1",
                    params![user_id],
                ).ok();
                Ok(user_id)
            } else {
                Err("密码不正确".to_string())
            }
        }
        Err(_) => Err("用户不存在".to_string()),
    }
}

#[tauri::command]
pub fn get_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_custom_data_dir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::Manager;
    let config_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_path = config_dir.join("config.json");
    let config = serde_json::json!({ "data_dir": path });
    std::fs::write(&config_path, config.to_string()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_custom_data_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri::Manager;
    let config_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_path = config_dir.join("config.json");
    if !config_path.exists() { return Ok(None); }
    let content = std::fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(json.get("data_dir").and_then(|v| v.as_str()).map(|s| s.to_string()))
}
