pub mod error;
pub mod services;

use tokio::sync::Mutex;
use std::sync::Arc;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, AppHandle,
};
use crate::services::storage::{StorageService, Settings, LedgerEntry};
use crate::services::audio::AudioRecorder;
use crate::error::AppError;
use validator::Validate;

struct AppState {
    recorder: Arc<Mutex<AudioRecorder>>,
    is_recording: Mutex<bool>,
    output_folder: Mutex<PathBuf>,
    current_recording_path: Mutex<Option<PathBuf>>,
}

#[tauri::command]
async fn start_recording_command(filename: Option<String>, mic_device: Option<String>, capture_system_audio: bool, app_handle: AppHandle) -> Result<(), AppError> {
    toggle_recording(&app_handle, filename, mic_device, capture_system_audio).await;
    Ok(())
}

#[tauri::command]
async fn stop_recording_command(app_handle: AppHandle, filename: Option<String>) -> Result<RecordingResult, AppError> {
    let state = app_handle.state::<AppState>();

    // 1. Stop Recorder & Rename if needed
    let (duration_sec, final_path) = {
        let mut recorder = state.recorder.lock().await;
        recorder.stop_recording(filename).map_err(AppError::Unexpected)?
    };

    let folder = final_path.parent().unwrap_or(std::path::Path::new("")).to_string_lossy().to_string();
    let file_path = final_path.to_string_lossy().to_string();

    Ok(RecordingResult {
        file_path,
        folder_path: folder,
        duration_sec,
    })
}

#[derive(serde::Serialize)]
struct RecordingResult {
    file_path: String,
    folder_path: String,
    duration_sec: f64,
}

#[derive(serde::Serialize)]
struct RecordingStatus {
    is_recording: bool,
    is_paused: bool,
    start_time_ms: Option<u64>,
}

#[tauri::command]
async fn get_recording_status_command(app_handle: AppHandle) -> Result<RecordingStatus, AppError> {
    let state = app_handle.state::<AppState>();
    let recorder = state.recorder.lock().await;
    let (is_recording, is_paused, start_time_ms) = recorder.get_status();
    Ok(RecordingStatus {
        is_recording,
        is_paused,
        start_time_ms,
    })
}

#[tauri::command]
async fn pause_recording_command(app_handle: AppHandle) -> Result<(), AppError> {
    let state = app_handle.state::<AppState>();
    let recorder = state.recorder.lock().await;
    recorder.pause_recording();
    Ok(())
}

#[tauri::command]
async fn resume_recording_command(app_handle: AppHandle) -> Result<(), AppError> {
    let state = app_handle.state::<AppState>();
    let recorder = state.recorder.lock().await;
    recorder.resume_recording();
    Ok(())
}

#[tauri::command]
async fn get_microphones_command() -> Result<Vec<(String, String)>, AppError> {
    Ok(AudioRecorder::get_microphones())
}

#[tauri::command]
async fn switch_microphone_command(device_name: String, app_handle: AppHandle) -> Result<(), AppError> {
    let state = app_handle.state::<AppState>();
    let mut recorder = state.recorder.lock().await;
    recorder.switch_microphone(device_name).map_err(Into::into)
}

#[tauri::command]
async fn delete_recording_command(path: String) -> Result<(), AppError> {
    let path_buf = PathBuf::from(path);
    if path_buf.exists() {
        std::fs::remove_file(path_buf)?;
    }
    Ok(())
}

#[tauri::command]
async fn add_recording_command(file_path: String, duration_sec: f64, app_handle: AppHandle) -> Result<LedgerEntry, AppError> {
    let mut entries = StorageService::load_ledger()?;
    
    let entry = LedgerEntry {
        local_id: uuid::Uuid::new_v4().to_string(),
        remote_id: None,
        file_path: file_path.clone(),
        upload_status: "incomplete".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        retry_count: 0,
        duration_sec,
    };
    
    entries.insert(0, entry.clone());
    
    StorageService::save_ledger(&entries)?;

    use tauri::Emitter;
    let _ = app_handle.emit("recording-added", &entry);

    Ok(entry)
}

#[tauri::command]
async fn get_recordings_command() -> Result<Vec<LedgerEntry>, AppError> {
    Ok(StorageService::load_ledger()?)
}

#[tauri::command]
async fn delete_recording_entry_command(local_id: String) -> Result<(), AppError> {
    let mut entries = StorageService::load_ledger()?;
    
    if let Some(index) = entries.iter().position(|e| e.local_id == local_id) {
        let entry = &entries[index];
        let path = PathBuf::from(&entry.file_path);
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
        
        entries.remove(index);
        StorageService::save_ledger(&entries)?;
    }
    
    Ok(())
}

#[tauri::command]
async fn check_connection_command(url: String, api_key: String) -> Result<bool, AppError> {
    let client = reqwest::Client::new();
    let base_url = url.trim_end_matches('/');
    let endpoint = format!("{}/api/v1/transcription/models", base_url);
    
    let resp = client.get(&endpoint)
        .header("X-API-Key", &api_key)
        .send()
        .await?;
        
    Ok(resp.status().is_success())
}

#[tauri::command]
async fn save_settings_command(settings: Settings, app_handle: AppHandle) -> Result<(), AppError> {
    settings.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    // Load old settings to check for path change
    let old_settings = load_settings_command(app_handle.clone()).await.unwrap_or(Settings {
        scriberr_url: "".to_string(),
        api_key: "".to_string(),
        output_path: "".to_string(),
    });

    let default_dir = app_handle.path().document_dir().unwrap_or(PathBuf::from("/"));
    let default_path = default_dir.join("ScriberrRecordings").to_string_lossy().to_string();

    let old_path_str = if old_settings.output_path.is_empty() {
        default_path.clone()
    } else {
        old_settings.output_path.clone()
    };

    let new_path_str = if settings.output_path.is_empty() {
        default_path
    } else {
        settings.output_path.clone()
    };

    if old_path_str != new_path_str {
        let old_path = PathBuf::from(&old_path_str);
        let new_path = PathBuf::from(&new_path_str);

        if old_path.exists() {
            if !new_path.exists() {
                std::fs::create_dir_all(&new_path)?;
            }

            let entries = std::fs::read_dir(&old_path)?;
            for entry in entries {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().ok_or(AppError::Unexpected("Invalid filename".into()))?;
                    let new_file_path = new_path.join(file_name);
                    std::fs::rename(&path, &new_file_path)?;
                }
            }
        }

        let mut ledger_entries = StorageService::load_ledger()?;
        for entry in &mut ledger_entries {
            let entry_path = PathBuf::from(&entry.file_path);
            if entry_path.starts_with(&old_path) {
                if let Ok(stripped) = entry_path.strip_prefix(&old_path) {
                    let new_entry_path = new_path.join(stripped);
                    entry.file_path = new_entry_path.to_string_lossy().to_string();
                }
            }
        }
        StorageService::save_ledger(&ledger_entries)?;

        let state = app_handle.state::<AppState>();
        *state.output_folder.lock().await = new_path;
    }
    
    StorageService::save_settings(&settings)?;
    Ok(())
}

#[tauri::command]
async fn load_settings_command(app_handle: AppHandle) -> Result<Settings, AppError> {
    let default_path = app_handle.path().document_dir().unwrap_or(PathBuf::from("/")).join("ScriberrRecordings").to_string_lossy().to_string();
    Ok(StorageService::load_settings(Some(default_path))?)
}

#[tauri::command]
async fn upload_recording_command(local_id: String, app_handle: AppHandle) -> Result<LedgerEntry, AppError> {
    let mut entries = StorageService::load_ledger()?;
    let settings = load_settings_command(app_handle).await?;
    
    if settings.scriberr_url.is_empty() || settings.api_key.is_empty() {
        return Err(AppError::Validation("Settings not configured".to_string()));
    }

    let index = entries.iter().position(|e| e.local_id == local_id).ok_or(AppError::NotFound("Recording not found".to_string()))?;
    let mut entry = entries[index].clone();
    
    // Check file existence
    let file_path = PathBuf::from(&entry.file_path);
    if !file_path.exists() {
        return Err(AppError::NotFound("File not found".to_string()));
    }

    // Prepare upload
    let client = reqwest::Client::new();
    let base_url = settings.scriberr_url.trim_end_matches('/');
    let endpoint = format!("{}/api/v1/transcription/upload", base_url);

    // Create multipart form
    // Read file manually to avoid async/sync confusion with Form::file
    let file_bytes = tokio::fs::read(&entry.file_path).await?;
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
        .await?;

    if response.status().is_success() {
        // Parse response to get remote ID
        let body: serde_json::Value = response.json().await?;
        if let Some(id) = body.get("id").and_then(|v| v.as_str()) {
            entry.remote_id = Some(id.to_string());
        }
        entry.upload_status = "uploaded".to_string();
    } else {
        entry.upload_status = "failed".to_string();
        entry.retry_count += 1;
    }

    // Update ledger
    entries[index] = entry.clone();
    StorageService::save_ledger(&entries)?;

    if entry.upload_status == "failed" {
        return Err(AppError::Network("Upload failed".to_string()));
    }

    Ok(entry)
}

#[tauri::command]
async fn check_file_exists_command(filename: String, app_handle: AppHandle) -> Result<bool, AppError> {
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
            get_recordings_command,
            delete_recording_entry_command,
            upload_recording_command,
            check_file_exists_command,
            get_recording_status_command
        ])
        .setup(move |app| {
            // builder.mount_events(app); // removed specta mount


            let documents_dir = app.path().document_dir().unwrap_or(PathBuf::from("/"));
            let default_output = documents_dir.join("ScriberrRecordings");
            
            // Try to load settings to get configured output path
            let output_folder = match StorageService::load_settings(None) {
                Ok(settings) if !settings.output_path.is_empty() => PathBuf::from(settings.output_path),
                _ => default_output.clone(),
            };

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


async fn toggle_recording(app: &AppHandle, filename: Option<String>, mic_device: Option<String>, capture_system_audio: bool) {
    let state = app.state::<AppState>();
    let mut is_recording = state.is_recording.lock().await;
    let mut recorder = state.recorder.lock().await;
    
    if *is_recording {
        // Stop
        // The actual stopping logic is now handled by stop_recording_command
        // This function will only toggle the state, not perform the stop operation directly
        *is_recording = false;
        println!("Stopped recording (via toggle)");
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
        
        match recorder.start_recording(path.clone(), mic_device.clone(), capture_system_audio, app.clone()).await {
            Ok(_) => {
                *is_recording = true;
                *state.current_recording_path.lock().await = Some(path);
                println!("Started recording (System: {}, Mic: {:?})", capture_system_audio, mic_device);
            }
            Err(e) => eprintln!("Failed to start recording: {}", e),
        }
    }
}
