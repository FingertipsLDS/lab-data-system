pub mod status;
use rusqlite::Connection;
use chrono::Local;
use std::path::Path;
use std::fs;

const MIGRATIONS: &[(u32, &str, &str)] = &[
    (1, "初始 schema", include_str!("001_initial.sql")),
    (2, "用户表", include_str!("002_users.sql")),
    (3, "文件来源路径", include_str!("003_source_path.sql")),
];

pub enum MigrationResult {
    NoChanges,
    Success { from: u32, to: u32 },
    Failed { failed_version: u32, error: String, rolled_back_to: u32, safety_backup_path: String },
}

pub fn run_migrations_safe(conn: &Connection, data_dir: &Path) -> Result<MigrationResult, String> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT OR IGNORE INTO _meta (key, value) VALUES ('schema_version', '0');").map_err(|e| e.to_string())?;
    let current = get_schema_version(conn);
    let target = MIGRATIONS.last().map(|(v,_,_)| *v).unwrap_or(0);
    if current >= target {
        status::write_status(data_dir, &status::MigrationStatus { state: status::MigrationState::Ok, current_version: current, target_version: target, timestamp: Local::now().to_rfc3339(), error: None }).ok();
        return Ok(MigrationResult::NoChanges);
    }
    let backup_path = create_pre_migration_backup(data_dir, current)?;
    for (version, description, sql) in MIGRATIONS {
        if *version <= current { continue; }
        println!("[Migration] v{}: {} ...", version, description);
        conn.execute_batch("BEGIN TRANSACTION;").map_err(|e| e.to_string())?;
        match conn.execute_batch(sql) {
            Ok(_) => {
                conn.execute("INSERT OR REPLACE INTO _meta (key,value) VALUES ('schema_version',?1)", rusqlite::params![version.to_string()]).map_err(|e| e.to_string())?;
                conn.execute("INSERT OR REPLACE INTO _meta (key,value) VALUES (?1,?2)", rusqlite::params![format!("migration_v{}_at",version), Local::now().to_rfc3339()]).ok();
                conn.execute_batch("COMMIT;").map_err(|e| e.to_string())?;
                println!("[Migration] v{} done", version);
            }
            Err(e) => {
                conn.execute_batch("ROLLBACK;").ok();
                let msg = format!("{}", e);
                status::write_status(data_dir, &status::MigrationStatus { state: status::MigrationState::Failed, current_version: current, target_version: target, timestamp: Local::now().to_rfc3339(), error: Some(status::MigrationErrorInfo { failed_version: *version, message: msg.clone(), rolled_back_to: current, backup_path: backup_path.clone() }) }).ok();
                return Ok(MigrationResult::Failed { failed_version: *version, error: msg, rolled_back_to: current, safety_backup_path: backup_path });
            }
        }
    }
    let fv = get_schema_version(conn);
    status::write_status(data_dir, &status::MigrationStatus { state: status::MigrationState::Upgraded, current_version: fv, target_version: target, timestamp: Local::now().to_rfc3339(), error: None }).ok();
    Ok(MigrationResult::Success { from: current, to: fv })
}

fn create_pre_migration_backup(data_dir: &Path, ver: u32) -> Result<String, String> {
    let dir = data_dir.join("migration_backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = dir.join(format!("pre_v{}_{}.db", ver, Local::now().format("%Y%m%d_%H%M%S")));
    let db = data_dir.join("biolab.db");
    if db.exists() { fs::copy(&db, &p).map_err(|e| format!("备份失败: {}", e))?; }
    Ok(p.to_string_lossy().to_string())
}

pub fn get_schema_version(conn: &Connection) -> u32 {
    conn.query_row("SELECT value FROM _meta WHERE key='schema_version'", [], |row| { let v: String = row.get(0)?; Ok(v.parse::<u32>().unwrap_or(0)) }).unwrap_or(0)
}
pub fn get_current_schema_version() -> u32 { MIGRATIONS.last().map(|(v,_,_)| *v).unwrap_or(0) }
