use std::fs;
use std::path::{Path, PathBuf, Component};
use std::io::Write;
use tauri::Manager;
use chrono::Local;

fn is_safe(name: &str) -> bool {
    let p = Path::new(name);
    if p.is_absolute() { return false; }
    for c in p.components() { match c { Component::ParentDir|Component::RootDir|Component::Prefix(_) => return false, _ => {} } }
    let n = name.replace('\\', "/");
    ["biolab.db","biolab.db-wal","biolab.db-shm","config.json","manifest.json","files/","templates/"].iter().any(|a| if a.ends_with('/') { n.starts_with(a) } else { n == *a })
}

fn add_dir(z: &mut zip::ZipWriter<fs::File>, dir: &Path, pfx: &str, o: zip::write::SimpleFileOptions) -> Result<(),String> {
    if !dir.exists() { return Ok(()); }
    for e in fs::read_dir(dir).map_err(|e|e.to_string())? {
        let e = e.map_err(|e|e.to_string())?; let p = e.path(); let n = format!("{}/{}", pfx, e.file_name().to_string_lossy());
        if p.is_dir() { add_dir(z, &p, &n, o)?; } else { let b = fs::read(&p).map_err(|e|e.to_string())?; z.start_file(&n, o).map_err(|e|e.to_string())?; z.write_all(&b).map_err(|e|e.to_string())?; }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_full_backup(app: tauri::AppHandle, dest_path: String) -> Result<String, String> {
    let dd = app.path().app_data_dir().map_err(|e|e.to_string())?;
    let ts = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let out = if Path::new(&dest_path).is_dir() { Path::new(&dest_path).join(format!("biolab-{}.biolab-backup",ts)) } else { PathBuf::from(&dest_path) };
    let f = fs::File::create(&out).map_err(|e|e.to_string())?;
    let mut z = zip::ZipWriter::new(f);
    let o = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for n in &["biolab.db","biolab.db-wal","biolab.db-shm"] { let p = dd.join(n); if p.exists() { let b=fs::read(&p).map_err(|e|e.to_string())?; z.start_file(*n,o).map_err(|e|e.to_string())?; z.write_all(&b).map_err(|e|e.to_string())?; } }
    add_dir(&mut z, &dd.join("files"), "files", o)?;
    let cp = dd.join("config.json"); if cp.exists() { let b=fs::read(&cp).map_err(|e|e.to_string())?; z.start_file("config.json",o).map_err(|e|e.to_string())?; z.write_all(&b).map_err(|e|e.to_string())?; }
    add_dir(&mut z, &dd.join("templates"), "templates", o)?;
    let m = serde_json::json!({"app_version":env!("CARGO_PKG_VERSION"),"created_at":Local::now().to_rfc3339(),"schema_version":crate::migrations::get_current_schema_version()});
    z.start_file("manifest.json",o).map_err(|e|e.to_string())?; z.write_all(m.to_string().as_bytes()).map_err(|e|e.to_string())?;
    z.finish().map_err(|e|e.to_string())?; Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn restore_from_backup(app: tauri::AppHandle, backup_path: String) -> Result<(), String> {
    let dd = app.path().app_data_dir().map_err(|e|e.to_string())?;
    let f = fs::File::open(&backup_path).map_err(|e|e.to_string())?;
    let mut ar = zip::ZipArchive::new(f).map_err(|e|format!("无法读取备份: {}",e))?;
    for i in 0..ar.len() { let e=ar.by_index(i).map_err(|e|e.to_string())?; if !is_safe(e.name()) { return Err(format!("不安全路径: {}",e.name())); } }
    let td = dd.join(".restore_temp"); if td.exists() { let _=fs::remove_dir_all(&td); } fs::create_dir_all(&td).map_err(|e|e.to_string())?;
    let f = fs::File::open(&backup_path).map_err(|e|e.to_string())?;
    let mut ar = zip::ZipArchive::new(f).map_err(|e|e.to_string())?;
    for i in 0..ar.len() {
        let mut e = ar.by_index(i).map_err(|e|e.to_string())?; let nm = e.name().to_string(); if !is_safe(&nm) { continue; }
        let tgt = td.join(&nm);
        if e.is_dir() { fs::create_dir_all(&tgt).map_err(|e|e.to_string())?; }
        else { if let Some(p)=tgt.parent() { fs::create_dir_all(p).map_err(|e|e.to_string())?; } let mut o=fs::File::create(&tgt).map_err(|e|e.to_string())?; std::io::copy(&mut e, &mut o).map_err(|e|e.to_string())?; }
    }
    let tdb=td.join("biolab.db"); if tdb.exists() { fs::copy(&tdb,dd.join("biolab.db")).map_err(|e|e.to_string())?; let _=fs::remove_file(dd.join("biolab.db-wal")); let _=fs::remove_file(dd.join("biolab.db-shm")); }
    let tf=td.join("files"); if tf.exists() { copy_r(&tf, &dd.join("files"))?; }
    let tc=td.join("config.json"); if tc.exists() { fs::copy(&tc,dd.join("config.json")).map_err(|e|e.to_string())?; }
    let _=fs::remove_dir_all(&td); Ok(())
}

#[tauri::command]
pub async fn auto_backup_if_needed(app: tauri::AppHandle) -> Result<(), String> {
    let dd = app.path().app_data_dir().map_err(|e|e.to_string())?;
    let bd = dd.join("auto_backups"); fs::create_dir_all(&bd).map_err(|e|e.to_string())?;
    let tb = bd.join(format!("auto-{}.biolab-backup", Local::now().format("%Y%m%d")));
    if tb.exists() { return Ok(()); }
    create_full_backup(app, tb.to_string_lossy().to_string()).await?;
    if let Ok(es) = fs::read_dir(&bd) { let mut v: Vec<_> = es.filter_map(|e|e.ok()).collect(); v.sort_by_key(|e|e.metadata().ok().and_then(|m|m.modified().ok())); if v.len() > 30 { for f in &v[..v.len()-30] { let _=fs::remove_file(f.path()); } } }
    Ok(())
}

fn copy_r(s: &Path, d: &Path) -> Result<(),String> {
    fs::create_dir_all(d).map_err(|e|e.to_string())?;
    for e in fs::read_dir(s).map_err(|e|e.to_string())? { let e=e.map_err(|e|e.to_string())?; let sp=e.path(); let dp=d.join(e.file_name()); if sp.is_dir() { copy_r(&sp,&dp)?; } else { fs::copy(&sp,&dp).map_err(|e|e.to_string())?; } }
    Ok(())
}
