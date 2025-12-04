pub mod discovery;
pub mod recorder;
mod mixer;

use tokio::sync::Mutex;
use std::sync::Arc;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, AppHandle,
};
use recorder::AudioRecorder;

struct AppState {
    recorder: Arc<Mutex<AudioRecorder>>,
    is_recording: Mutex<bool>,
    output_folder: Mutex<PathBuf>,
    recording_app_pid: Mutex<Option<i32>>,
    current_recording_path: Mutex<Option<PathBuf>>,
}

use discovery::RunnableApp;

#[tauri::command]
async fn get_apps() -> Result<Vec<RunnableApp>, String> {
    discovery::get_running_meeting_apps().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_recording_command(pid: i32, filename: Option<String>, mic_device: Option<String>, app_handle: AppHandle) -> Result<(), String> {
    toggle_recording(&app_handle, pid, filename, mic_device).await;
    Ok(())
}

#[tauri::command]
async fn delete_recording_command(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    if path_buf.exists() {
        std::fs::remove_file(path_buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn pause_recording_command(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    let recorder = state.recorder.lock().await;
    recorder.pause_recording();
    Ok(())
}

#[tauri::command]
async fn resume_recording_command(app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    let recorder = state.recorder.lock().await;
    recorder.resume_recording();
    Ok(())
}

#[tauri::command]
async fn get_microphones_command() -> Result<Vec<(String, String)>, String> {
    Ok(AudioRecorder::get_microphones())
}

#[tauri::command]
async fn switch_microphone_command(device_name: String, app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    let mut recorder = state.recorder.lock().await;
    recorder.switch_microphone(device_name)
}

#[derive(serde::Serialize)]
struct RecordingResult {
    file_path: String,
    folder_path: String,
}

#[tauri::command]
async fn stop_recording_command(app_handle: AppHandle) -> Result<RecordingResult, String> {
    let state = app_handle.state::<AppState>();
    let mut is_recording = state.is_recording.lock().await;
    let mut recorder = state.recorder.lock().await;
    
    println!("Stop command received. Is recording: {}", *is_recording);
    
    if *is_recording {
        if let Err(e) = recorder.stop_recording() {
            eprintln!("Error stopping recording: {}", e);
            return Err(e.to_string());
        }
        *is_recording = false;
        *state.recording_app_pid.lock().await = None;
        println!("Recording stopped successfully");
        
        let folder = state.output_folder.lock().await.clone();
        let folder_str = folder.to_string_lossy().to_string();
        
        let path_opt = state.current_recording_path.lock().await.clone();
        let file_str = path_opt.map(|p| p.to_string_lossy().to_string()).unwrap_or_default();

        return Ok(RecordingResult {
            file_path: file_str,
            folder_path: folder_str,
        });
    }
    Err("Not recording".to_string())
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct Settings {
    scriberr_url: String,
    api_key: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct LedgerEntry {
    local_id: String,
    remote_id: Option<String>,
    file_path: String,
    upload_status: String, // "incomplete", "uploaded", "failed"
    created_at: String,
    retry_count: u32,
}

fn get_ledger_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config").join("scriberr-companion").join("ledger.json")
}

fn get_ledger_tmp_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config").join("scriberr-companion").join("ledger.json.tmp")
}

fn load_ledger() -> Vec<LedgerEntry> {
    let path = get_ledger_path();
    let tmp_path = get_ledger_tmp_path();

    // Recovery: If tmp exists, it means previous write failed or crashed. 
    // Assume tmp is the intended new state.
    if tmp_path.exists() {
        let _ = std::fs::rename(&tmp_path, &path);
    }

    if !path.exists() {
        return Vec::new();
    }

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    serde_json::from_str(&content).unwrap_or_default()
}

fn save_ledger(entries: &Vec<LedgerEntry>) -> Result<(), String> {
    let path = get_ledger_path();
    let tmp_path = get_ledger_tmp_path();

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    
    // Atomic write: Write to tmp, then rename
    std::fs::write(&tmp_path, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn add_recording_command(file_path: String) -> Result<LedgerEntry, String> {
    let mut entries = load_ledger();
    
    let entry = LedgerEntry {
        local_id: uuid::Uuid::new_v4().to_string(),
        remote_id: None,
        file_path: file_path.clone(),
        upload_status: "incomplete".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        retry_count: 0,
    };
    
    // Prepend to list (newest first)
    entries.insert(0, entry.clone());
    
    save_ledger(&entries)?;
    Ok(entry)
}

#[tauri::command]
async fn get_recordings_command() -> Result<Vec<LedgerEntry>, String> {
    Ok(load_ledger())
}

#[tauri::command]
async fn delete_recording_entry_command(local_id: String) -> Result<(), String> {
    let mut entries = load_ledger();
    
    if let Some(index) = entries.iter().position(|e| e.local_id == local_id) {
        let entry = &entries[index];
        // Try to delete file
        let path = PathBuf::from(&entry.file_path);
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
        
        entries.remove(index);
        save_ledger(&entries)?;
    }
    
    Ok(())
}

#[tauri::command]
async fn check_connection_command(url: String, api_key: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let base_url = url.trim_end_matches('/');
    let endpoint = format!("{}/api/v1/transcription/models", base_url);
    
    let resp = client.get(&endpoint)
        .header("X-API-Key", &api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;
        
    Ok(resp.status().is_success())
}

fn get_settings_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config").join("scriberr-companion").join("settings.json")
}

#[tauri::command]
async fn save_settings_command(settings: Settings) -> Result<(), String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn load_settings_command() -> Result<Settings, String> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(Settings {
            scriberr_url: "".to_string(),
            api_key: "".to_string(),
        });
    }
    
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let settings: Settings = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(settings)
}

#[tauri::command]
async fn upload_recording_command(local_id: String) -> Result<LedgerEntry, String> {
    let mut entries = load_ledger();
    let settings = load_settings_command().await?;
    
    if settings.scriberr_url.is_empty() || settings.api_key.is_empty() {
        return Err("Settings not configured".to_string());
    }

    let index = entries.iter().position(|e| e.local_id == local_id).ok_or("Recording not found")?;
    let mut entry = entries[index].clone();
    
    // Check file existence
    let file_path = PathBuf::from(&entry.file_path);
    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    // Prepare upload
    let client = reqwest::Client::new();
    let base_url = settings.scriberr_url.trim_end_matches('/');
    let endpoint = format!("{}/api/v1/transcription/upload", base_url);

    // Create multipart form
    // Read file manually to avoid async/sync confusion with Form::file
    let file_bytes = tokio::fs::read(&entry.file_path).await.map_err(|e| format!("Failed to read file: {}", e))?;
    let filename = PathBuf::from(&entry.file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("recording.wav")
        .to_string();

    let part = reqwest::multipart::Part::bytes(file_bytes).file_name(filename.clone());
    let form = reqwest::multipart::Form::new()
        .part("audio", part)
        .text("title", filename);

    // Send request
    let response = client.post(&endpoint)
        .header("X-API-Key", &settings.api_key)
        .multipart(form)
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                // Parse response to get remote ID
                let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                if let Some(id) = body.get("id").and_then(|v| v.as_str()) {
                    entry.remote_id = Some(id.to_string());
                }
                entry.upload_status = "uploaded".to_string();
            } else {
                entry.upload_status = "failed".to_string();
                entry.retry_count += 1;
            }
        },
        Err(_) => {
            entry.upload_status = "failed".to_string();
            entry.retry_count += 1;
        }
    }

    // Update ledger
    entries[index] = entry.clone();
    save_ledger(&entries)?;

    if entry.upload_status == "failed" {
        return Err("Upload failed".to_string());
    }

    Ok(entry)
}

#[tauri::command]
async fn check_file_exists_command(filename: String, app_handle: AppHandle) -> Result<bool, String> {
    let state = app_handle.state::<AppState>();
    let folder = state.output_folder.lock().await.clone();
    // Check both with and without extension to be safe, or just normalize as we do in start
    let name = if filename.to_lowercase().ends_with(".wav") { 
        filename 
    } else { 
        format!("{}.wav", filename) 
    };
    let path = folder.join(name);
    Ok(path.exists())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_apps, 
            start_recording_command, 
            stop_recording_command, 
            pause_recording_command, 
            resume_recording_command, 
            get_microphones_command, 
            switch_microphone_command, 
            delete_recording_command,
            check_connection_command,
            save_settings_command,
            load_settings_command,
            add_recording_command,
            get_recordings_command,
            delete_recording_entry_command,
            upload_recording_command,
            check_file_exists_command
        ])
        .setup(|app| {
            let documents_dir = app.path().document_dir().unwrap_or(PathBuf::from("/"));
            let output_folder = documents_dir.join("ScriberrRecordings");
            if !output_folder.exists() {
                let _ = std::fs::create_dir_all(&output_folder);
            }

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle", "Toggle Window", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[
                &toggle_i,
                &PredefinedMenuItem::separator(app)?,
                &quit_i,
            ])?;

            let state = AppState {
                recorder: Arc::new(Mutex::new(AudioRecorder::new())),
                is_recording: Mutex::new(false),
                output_folder: Mutex::new(output_folder.clone()),
                recording_app_pid: Mutex::new(None),
                current_recording_path: Mutex::new(None),
            };
            app.manage(state);

            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "toggle" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



async fn toggle_recording(app: &AppHandle, pid: i32, filename: Option<String>, mic_device: Option<String>) {
    let state = app.state::<AppState>();
    let mut is_recording = state.is_recording.lock().await;
    let mut recorder = state.recorder.lock().await;
    
    if *is_recording {
        // Stop
        if let Err(e) = recorder.stop_recording() {
            eprintln!("Failed to stop recording: {}", e);
        }
        *is_recording = false;
        *state.recording_app_pid.lock().await = None;
        println!("Stopped recording");
    } else {
        // Start
        let folder = state.output_folder.lock().await.clone();
        let name = filename.unwrap_or_else(|| {
            let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
            format!("recording_{}.wav", timestamp)
        });
        // Ensure extension
        let name = if name.ends_with(".wav") { name } else { format!("{}.wav", name) };
        let path = folder.join(name);
        
        match recorder.start_recording(pid, path.clone(), mic_device).await {
            Ok(_) => {
                *is_recording = true;
                *state.recording_app_pid.lock().await = Some(pid);
                *state.current_recording_path.lock().await = Some(path);
                println!("Started recording PID {}", pid);
            }
            Err(e) => eprintln!("Failed to start recording: {}", e),
        }
    }
}
