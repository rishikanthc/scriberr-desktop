use screencapturekit::sc_shareable_content::SCShareableContent;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RunnableApp {
    pub id: String, // Bundle ID
    pub pid: i32,
    pub name: String,
    pub icon: Vec<u8>, // Optional: for UI if needed later
}

pub async fn get_running_meeting_apps() -> Result<Vec<RunnableApp>, String> {
    let content = SCShareableContent::current();
        //.map_err(|e| format!("Failed to get shareable content: {:?}", e))?; // v0.2.8 might not return Result or different error

    let target_bundle_ids = vec![
        "us.zoom.xos",
        "com.tinyspeck.slackmacgap",
        "com.microsoft.teams",
        "com.microsoft.teams2",
    ];

    let mut apps = Vec::new();

    for app in content.applications {
        if let Some(bundle_id) = &app.bundle_identifier {
            if target_bundle_ids.contains(&bundle_id.as_str()) {
                apps.push(RunnableApp {
                    id: bundle_id.clone(),
                    pid: app.process_id,
                    name: app.application_name.clone().unwrap_or_default(),
                    icon: Vec::new(), // Placeholder, SCShareableContent doesn't give icon bytes directly usually
                });
            }
        }
    }

    Ok(apps)
}
