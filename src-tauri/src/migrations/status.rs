use std::path::Path; use std::fs; use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MigrationStatus { pub state: MigrationState, pub current_version: u32, pub target_version: u32, pub timestamp: String, pub error: Option<MigrationErrorInfo> }

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MigrationState { Ok, Upgraded, Failed, Acknowledged }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MigrationErrorInfo { pub failed_version: u32, pub message: String, pub rolled_back_to: u32, pub backup_path: String }

pub fn write_status(data_dir: &Path, s: &MigrationStatus) -> Result<(), String> {
    fs::write(data_dir.join("migration_status.json"), serde_json::to_string_pretty(s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

pub fn read_status(data_dir: &Path) -> Option<MigrationStatus> {
    serde_json::from_str(&fs::read_to_string(data_dir.join("migration_status.json")).ok()?).ok()
}
