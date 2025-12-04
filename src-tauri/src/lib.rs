pub mod discovery;
pub mod recorder;
mod mixer;

use tokio::sync::Mutex;
use std::sync::Arc;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, Submenu, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, AppHandle, Emitter,
};
use tauri_plugin_dialog::DialogExt;
use recorder::AudioRecorder;

struct AppState {
    recorder: Arc<Mutex<AudioRecorder>>,
    is_recording: Mutex<bool>,
    output_folder: Mutex<PathBuf>,
    recording_app_pid: Mutex<Option<i32>>,
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

#[tauri::command]
async fn stop_recording_command(app_handle: AppHandle) -> Result<String, String> {
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
        
        // Return the folder path to open it
        let folder = state.output_folder.lock().await.clone();
        // Wait, we need the actual file path, not just folder.
        // But recorder doesn't store the current file path in a way we can easily get it here unless we stored it in state.
        // However, the UI might know the filename it passed.
        // But for now, let's return the folder as before, or maybe the last file?
        // Actually, the UI will construct the path, so returning folder is fine, OR we can return the full path if we stored it.
        // Let's stick to returning folder for now, or empty string.
        // The user wants to "Review" the file. The UI knows the filename it sent.
        return Ok(folder.to_string_lossy().to_string());
    }
    Ok("".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_apps, start_recording_command, stop_recording_command, pause_recording_command, resume_recording_command, get_microphones_command, switch_microphone_command, delete_recording_command])
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
        
        match recorder.start_recording(pid, path, mic_device).await {
            Ok(_) => {
                *is_recording = true;
                *state.recording_app_pid.lock().await = Some(pid);
                println!("Started recording PID {}", pid);
            }
            Err(e) => eprintln!("Failed to start recording: {}", e),
        }
    }
}
