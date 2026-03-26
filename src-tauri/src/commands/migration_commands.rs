use crate::migrations::status;
use tauri::Manager;

#[tauri::command] pub fn get_migration_status(app: tauri::AppHandle) -> Result<Option<status::MigrationStatus>, String> { let d = app.path().app_data_dir().map_err(|e| e.to_string())?; Ok(status::read_status(&d)) }
#[tauri::command] pub fn acknowledge_migration_error(app: tauri::AppHandle) -> Result<(), String> { let d = app.path().app_data_dir().map_err(|e| e.to_string())?; if let Some(mut s) = status::read_status(&d) { if s.state == status::MigrationState::Failed { s.state = status::MigrationState::Acknowledged; status::write_status(&d, &s)?; } } Ok(()) }
#[tauri::command] pub fn dismiss_upgrade_notice(app: tauri::AppHandle) -> Result<(), String> { let d = app.path().app_data_dir().map_err(|e| e.to_string())?; if let Some(mut s) = status::read_status(&d) { if s.state == status::MigrationState::Upgraded { s.state = status::MigrationState::Ok; status::write_status(&d, &s)?; } } Ok(()) }
