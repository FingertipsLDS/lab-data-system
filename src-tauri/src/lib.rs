mod commands;
mod migrations;
mod security;

use commands::db_commands::DbState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            std::fs::create_dir_all(data_dir.join("files"))?;
            println!("[BioLab] 数据目录: {:?}", data_dir);

            let db_path = data_dir.join("biolab.db");
            let conn = rusqlite::Connection::open(&db_path).expect("无法打开数据库文件");
            conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;").ok();
            println!("[BioLab] 数据库已打开");

            match migrations::run_migrations_safe(&conn, &data_dir) {
                Ok(migrations::MigrationResult::NoChanges) => println!("[BioLab] 数据库已是最新"),
                Ok(migrations::MigrationResult::Success { from, to }) => println!("[BioLab] 数据库 v{} -> v{}", from, to),
                Ok(migrations::MigrationResult::Failed { failed_version, error, .. }) => eprintln!("[BioLab] 迁移v{}失败: {}", failed_version, error),
                Err(e) => eprintln!("[BioLab] 迁移错误: {}", e),
            }

            app.manage(DbState(Mutex::new(conn)));
            println!("[BioLab] 就绪");

            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = commands::backup_commands::auto_backup_if_needed(h).await { eprintln!("[BioLab] 自动备份失败: {}", e); }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::security_commands::has_launch_password, commands::security_commands::verify_launch_password,
            commands::security_commands::set_launch_password, commands::security_commands::clear_launch_password,
            commands::security_commands::rekey_database, commands::security_commands::store_api_key, commands::security_commands::get_api_key,
            commands::migration_commands::get_migration_status, commands::migration_commands::acknowledge_migration_error, commands::migration_commands::dismiss_upgrade_notice,
            commands::backup_commands::create_full_backup, commands::backup_commands::restore_from_backup, commands::backup_commands::auto_backup_if_needed,
            commands::user_commands::check_has_users, commands::user_commands::get_user_list,
            commands::user_commands::register_user, commands::user_commands::login_user,
            commands::user_commands::get_data_dir, commands::user_commands::set_custom_data_dir, commands::user_commands::get_custom_data_dir, commands::user_commands::change_password,
            commands::db_commands::get_projects, commands::db_commands::get_project, commands::db_commands::create_project, commands::db_commands::update_project, commands::db_commands::delete_project,
            commands::db_commands::get_experiments, commands::db_commands::get_experiments_by_project, commands::db_commands::create_experiment, commands::db_commands::update_experiment, commands::db_commands::delete_experiment,
            commands::db_commands::get_results, commands::db_commands::create_result, commands::db_commands::delete_result,
            commands::db_commands::get_tasks, commands::db_commands::create_task, commands::db_commands::update_task, commands::db_commands::delete_task,
            commands::db_commands::get_references, commands::db_commands::create_reference, commands::db_commands::delete_reference,
            commands::db_commands::get_files, commands::db_commands::get_templates, commands::db_commands::search_all,
            commands::file_commands::import_files_to_experiment, commands::file_commands::get_experiment_files,
            commands::file_commands::delete_experiment_file, commands::file_commands::open_file, commands::file_commands::read_file_base64,
        ])
        .run(tauri::generate_context!()).expect("Lab Data System 启动失败");
}
