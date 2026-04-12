use crate::security::key_manager;
use tauri::Manager;

#[tauri::command] pub fn has_launch_password() -> Result<bool, String> { key_manager::has_launch_password() }
#[tauri::command] pub fn verify_launch_password(password: String) -> Result<bool, String> { key_manager::verify_launch_password(&password) }
#[tauri::command] pub fn set_launch_password(password: String) -> Result<(), String> { key_manager::set_launch_password(&password) }
#[tauri::command] pub fn clear_launch_password() -> Result<(), String> { key_manager::clear_launch_password() }
#[tauri::command] pub fn rekey_database(app: tauri::AppHandle) -> Result<(), String> { let d = app.path().app_data_dir().map_err(|e| e.to_string())?; crate::security::database::rekey_database(d.join("biolab.db").to_str().ok_or("bad path")?) }
#[tauri::command] pub fn store_api_key(provider: String, api_key: String) -> Result<(), String> { let e = keyring::Entry::new("com.biolab.app", &format!("api_key_{}", provider)).map_err(|e| e.to_string())?; e.set_password(&api_key).map_err(|e| e.to_string()) }
#[tauri::command] pub fn get_api_key(provider: String) -> Result<Option<String>, String> { let e = keyring::Entry::new("com.biolab.app", &format!("api_key_{}", provider)).map_err(|e| e.to_string())?; match e.get_password() { Ok(v) => Ok(Some(v)), Err(keyring::Error::NoEntry) => Ok(None), Err(e) => Err(e.to_string()) } }

#[tauri::command]
pub fn delete_user(db_state: tauri::State<'_, crate::commands::db_commands::DbState>, username: String) -> Result<(), String> {
    let conn = db_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM users WHERE username = ?1", rusqlite::params![username]).map_err(|e| e.to_string())?;
    Ok(())
}
