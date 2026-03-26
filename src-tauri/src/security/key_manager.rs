use rand::RngExt;
const SERVICE: &str = "com.biolab.app";
const DB_KEY: &str = "db_master_key";
const PW_HASH: &str = "launch_password_hash";

pub fn ensure_master_key() -> Result<String, String> {
    let e = keyring::Entry::new(SERVICE, DB_KEY).map_err(|e| e.to_string())?;
    match e.get_password() {
        Ok(k) => Ok(k),
        Err(keyring::Error::NoEntry) => { let k = gen_key(); e.set_password(&k).map_err(|e| format!("Keychain写入失败: {}", e))?; println!("[Security] 已生成数据库主密钥"); Ok(k) }
        Err(e) => Err(format!("Keychain读取失败: {}", e)),
    }
}
pub fn get_master_key() -> Result<String, String> { let e = keyring::Entry::new(SERVICE, DB_KEY).map_err(|e| e.to_string())?; e.get_password().map_err(|e| e.to_string()) }
pub fn rotate_master_key() -> Result<(String, String), String> { Ok((get_master_key()?, gen_key())) }
pub fn commit_new_master_key(k: &str) -> Result<(), String> { let e = keyring::Entry::new(SERVICE, DB_KEY).map_err(|e| e.to_string())?; e.set_password(k).map_err(|e| e.to_string()) }
pub fn set_launch_password(pw: &str) -> Result<(), String> { let h = bcrypt::hash(pw, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?; let e = keyring::Entry::new(SERVICE, PW_HASH).map_err(|e| e.to_string())?; e.set_password(&h).map_err(|e| e.to_string()) }
pub fn verify_launch_password(pw: &str) -> Result<bool, String> { let e = keyring::Entry::new(SERVICE, PW_HASH).map_err(|e| e.to_string())?; match e.get_password() { Ok(h) => bcrypt::verify(pw, &h).map_err(|e| e.to_string()), Err(keyring::Error::NoEntry) => Ok(true), Err(e) => Err(e.to_string()) } }
pub fn has_launch_password() -> Result<bool, String> { let e = keyring::Entry::new(SERVICE, PW_HASH).map_err(|e| e.to_string())?; match e.get_password() { Ok(_) => Ok(true), Err(keyring::Error::NoEntry) => Ok(false), Err(e) => Err(e.to_string()) } }
pub fn clear_launch_password() -> Result<(), String> { let e = keyring::Entry::new(SERVICE, PW_HASH).map_err(|e| e.to_string())?; match e.delete_credential() { Ok(_) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(e.to_string()) } }
fn gen_key() -> String { let mut b = [0u8; 32]; rand::rng().fill(&mut b); hex::encode(b) }
