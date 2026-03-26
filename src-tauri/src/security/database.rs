use rusqlite::Connection;
use super::key_manager;

pub fn open_database(db_path: &str) -> Result<Connection, String> {
    let key = key_manager::ensure_master_key()?;
    let conn = Connection::open(db_path).map_err(|e| format!("无法打开数据库: {}", e))?;
    conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", key)).map_err(|e| e.to_string())?;
    conn.execute_batch("SELECT count(*) FROM sqlite_master;").map_err(|_| "数据库解密失败".to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;").map_err(|e| e.to_string())?;
    println!("[Database] 已就绪"); Ok(conn)
}

pub fn rekey_database(db_path: &str) -> Result<(), String> {
    let (old, new) = key_manager::rotate_master_key()?;
    let c = Connection::open(db_path).map_err(|e| e.to_string())?;
    c.execute_batch(&format!("PRAGMA key = \"x'{}'\";", old)).map_err(|e| e.to_string())?;
    c.execute_batch("SELECT count(*) FROM sqlite_master;").map_err(|_| "旧密钥无效".to_string())?;
    c.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", new)).map_err(|e| format!("rekey失败: {}", e))?;
    drop(c);
    let v = Connection::open(db_path).map_err(|e| e.to_string())?;
    v.execute_batch(&format!("PRAGMA key = \"x'{}'\";", new)).map_err(|e| e.to_string())?;
    v.execute_batch("SELECT count(*) FROM sqlite_master;").map_err(|_| "新密钥验证失败".to_string())?;
    drop(v); key_manager::commit_new_master_key(&new)?;
    println!("[Security] 密钥轮换完成"); Ok(())
}
