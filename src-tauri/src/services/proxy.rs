use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::get,
    Router,
    body::Body,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use crate::services::storage::Settings;

#[derive(Clone)]
pub struct ProxyState {
    pub settings: Arc<RwLock<Settings>>,
    pub client: reqwest::Client,
}

pub struct ProxyService;

impl ProxyService {
    pub async fn start(settings: Arc<RwLock<Settings>>, shutdown_rx: oneshot::Receiver<()>) -> Result<u16, Box<dyn std::error::Error>> {
        let client = reqwest::Client::builder()
            .build()?;

        let state = ProxyState {
            settings,
            client,
        };

        // Define the app
        let app = Router::new()
            .route("/stream/:job_id", get(proxy_handler))
            .with_state(state);

        // Bind to port 0 (ephemeral) on localhost
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let port = listener.local_addr()?.port();

        // Spawn the server
        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    shutdown_rx.await.ok();
                })
                .await 
            {
                eprintln!("Proxy server error: {}", e);
            }
        });

        Ok(port)
    }
}

async fn proxy_handler(
    State(state): State<ProxyState>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    println!("[PROXY] Received request for job_id: {}", job_id);

    // 1. Get Settings
    let (base_url, api_key) = {
        let s = state.settings.read().await;
        if s.scriberr_url.is_empty() {
             eprintln!("[PROXY] Error: Scriberr URL is empty in settings");
             return Err(StatusCode::SERVICE_UNAVAILABLE); // Configuration missing
        }
        (s.scriberr_url.clone(), s.api_key.clone())
    };

    // 2. Construct Upstream URL
    let url = format!("{}/api/v1/transcription/{}/audio", base_url.trim_end_matches('/'), job_id);
    println!("[PROXY] Connecting to Upstream: {}", url);

    // 3. Prepare Request
    let mut req_builder = state.client.get(&url)
        .header("X-API-Key", &api_key); 
    
    // Override ReqBuilder to include range header if present in incoming request
    if let Some(range) = headers.get("range") {
       println!("[PROXY] Forwarding Range Header: {:?}", range);
       req_builder = req_builder.header("Range", range);
    }

    // 4. Send Request
    let upstream_resp = req_builder
        .send()
        .await
        .map_err(|e| {
            eprintln!("[PROXY] Upstream Request Failed: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    // 5. Handle Status
    let status = upstream_resp.status();
    println!("[PROXY] Upstream Status: {}", status);
    
    if !status.is_success() && status != StatusCode::PARTIAL_CONTENT {
        // ... err handling
        return Err(match status {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => StatusCode::FORBIDDEN,
            StatusCode::NOT_FOUND => {
                eprintln!("[PROXY] 404 Not Found from upstream");
                StatusCode::NOT_FOUND
            },
            _ => StatusCode::BAD_GATEWAY,
        });
    }

    // 6. Build Downstream Response
    let mut response_builder = Response::builder().status(status);

    // Forward Headers
    if let Some(h) = upstream_resp.headers().get("content-type") {
        response_builder = response_builder.header("content-type", h);
    }
    if let Some(h) = upstream_resp.headers().get("content-length") {
        response_builder = response_builder.header("content-length", h);
    }
    if let Some(h) = upstream_resp.headers().get("content-range") {
        response_builder = response_builder.header("content-range", h);
    }
    if let Some(h) = upstream_resp.headers().get("accept-ranges") {
        response_builder = response_builder.header("accept-ranges", h);
    }

    // CORS for Web Audio API
    response_builder = response_builder.header("access-control-allow-origin", "*");
    
    // 7. Stream Body
    let body = Body::from_stream(upstream_resp.bytes_stream());

    response_builder
        .body(body)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
