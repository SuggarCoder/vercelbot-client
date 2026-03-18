use std::collections::HashSet;
use std::net::SocketAddr;
use std::process::Command;
use std::sync::Arc;

use axum::body::{to_bytes, Body};
use axum::extract::{Request, State as AxumState};
use axum::http::{header::HOST, HeaderMap, HeaderValue, Response, StatusCode, Uri};
use axum::response::IntoResponse;
use axum::routing::any;
use axum::Router;
use futures_util::TryStreamExt;
use include_dir::{include_dir, Dir};
use mime_guess::from_path;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{State as TauriState, WebviewUrl, WebviewWindowBuilder};

static CHATBOT_DIST: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../chatbot/dist");
static APP_CONFIG_JSON: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../gpas.config.json"));

const DEV_SERVER_PORT: u16 = 1420;
const PROD_SERVER_PORT: u16 = 4318;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    remote_api_base_url: String,
    #[serde(default)]
    allowed_commands: Vec<String>,
}

#[derive(Clone)]
struct ServerState {
    client: Client,
    remote_api_base_url: String,
}

#[derive(Clone)]
struct DesktopToolState {
    allowed_commands: Arc<HashSet<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopToolCall {
    call_id: String,
    chat_id: String,
    tool_name: String,
    #[serde(default)]
    args: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopToolResult {
    call_id: String,
    chat_id: String,
    tool_name: String,
    status: String,
    output: Option<Value>,
    error: Option<String>,
}

fn load_config() -> AppConfig {
    serde_json::from_str(APP_CONFIG_JSON).expect("invalid gpas.config.json")
}

fn server_port() -> u16 {
    if cfg!(debug_assertions) {
        DEV_SERVER_PORT
    } else {
        PROD_SERVER_PORT
    }
}

fn local_server_url() -> String {
    format!("http://127.0.0.1:{}", server_port())
}

fn remote_api_url(base: &str, uri: &Uri) -> String {
    let path_and_query = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or(uri.path());
    let suffix = path_and_query
        .strip_prefix("/api")
        .unwrap_or(path_and_query);
    let normalized_suffix = if suffix.is_empty() { "/" } else { suffix };
    format!("{}{}", base.trim_end_matches('/'), normalized_suffix)
}

fn copy_headers(source: &HeaderMap, destination: &mut HeaderMap) {
    for (name, value) in source.iter() {
        if name == HOST {
            continue;
        }
        destination.append(name, value.clone());
    }
}

async fn proxy_api(
    AxumState(state): AxumState<ServerState>,
    request: Request,
) -> impl IntoResponse {
    let upstream_url = remote_api_url(&state.remote_api_base_url, request.uri());
    let method = request.method().clone();
    let headers = request.headers().clone();
    let body = match to_bytes(request.into_body(), usize::MAX).await {
        Ok(body) => body,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                format!("failed to read request body: {error}"),
            )
                .into_response()
        }
    };

    let mut upstream_request = state.client.request(method, upstream_url);
    let mut upstream_headers = reqwest::header::HeaderMap::new();
    for (name, value) in headers.iter() {
        if name == HOST {
            continue;
        }
        upstream_headers.append(name, value.clone());
    }
    upstream_request = upstream_request.headers(upstream_headers).body(body);

    let upstream_response = match upstream_request.send().await {
        Ok(response) => response,
        Err(error) => {
            return (
                StatusCode::BAD_GATEWAY,
                format!("upstream request failed: {error}"),
            )
                .into_response()
        }
    };

    let status = upstream_response.status();
    let upstream_headers = upstream_response.headers().clone();
    let stream = upstream_response
        .bytes_stream()
        .map_err(std::io::Error::other);

    let mut response = Response::new(Body::from_stream(stream));
    *response.status_mut() = status;
    copy_headers(&upstream_headers, response.headers_mut());
    response
}

fn response_with_bytes(path: &str, bytes: Vec<u8>) -> Response<Body> {
    let mime = from_path(path).first_or_octet_stream();
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_str(mime.as_ref())
            .unwrap_or(HeaderValue::from_static("application/octet-stream")),
    );
    response
}

async fn serve_chatbot_asset(uri: Uri) -> impl IntoResponse {
    let requested = match uri.path() {
        "/" => "index.html",
        path => path.trim_start_matches('/'),
    };

    if let Some(file) = CHATBOT_DIST.get_file(requested) {
        return response_with_bytes(requested, file.contents().to_vec());
    }

    if let Some(index) = CHATBOT_DIST.get_file("index.html") {
        return response_with_bytes("index.html", index.contents().to_vec());
    }

    (
        StatusCode::NOT_FOUND,
        "chatbot build artifacts are missing from the desktop bundle",
    )
        .into_response()
}

async fn start_release_server(config: AppConfig) {
    let address = SocketAddr::from(([127, 0, 0, 1], PROD_SERVER_PORT));
    let state = ServerState {
        client: Client::new(),
        remote_api_base_url: config.remote_api_base_url,
    };

    let app = Router::new()
        .route("/api/{*path}", any(proxy_api))
        .route("/api", any(proxy_api))
        .fallback(serve_chatbot_asset)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("failed to bind local desktop server");

    axum::serve(listener, app)
        .await
        .expect("local desktop server crashed");
}

fn success_result(call: &DesktopToolCall, output: Option<Value>) -> DesktopToolResult {
    DesktopToolResult {
        call_id: call.call_id.clone(),
        chat_id: call.chat_id.clone(),
        tool_name: call.tool_name.clone(),
        status: "success".to_string(),
        output,
        error: None,
    }
}

fn error_result(
    call: &DesktopToolCall,
    status: &str,
    error: impl Into<String>,
) -> DesktopToolResult {
    DesktopToolResult {
        call_id: call.call_id.clone(),
        chat_id: call.chat_id.clone(),
        tool_name: call.tool_name.clone(),
        status: status.to_string(),
        output: None,
        error: Some(error.into()),
    }
}

#[tauri::command]
fn run_desktop_tool(
    state: TauriState<'_, DesktopToolState>,
    call: DesktopToolCall,
) -> Result<DesktopToolResult, String> {
    match call.tool_name.as_str() {
        "open_url" => {
            let url = call
                .args
                .get("url")
                .and_then(Value::as_str)
                .ok_or("open_url requires args.url")?;

            webbrowser::open(url).map_err(|error| error.to_string())?;
            Ok(success_result(
                &call,
                Some(serde_json::json!({ "url": url })),
            ))
        }
        "run_command" => {
            let command = call
                .args
                .get("command")
                .and_then(Value::as_str)
                .ok_or("run_command requires args.command")?;

            if !state.allowed_commands.contains(command) {
                return Ok(error_result(
                    &call,
                    "denied",
                    format!("command `{command}` is not allowed"),
                ));
            }

            let mut process = Command::new(command);

            if let Some(arguments) = call.args.get("args").and_then(Value::as_array) {
                for argument in arguments.iter().filter_map(Value::as_str) {
                    process.arg(argument);
                }
            }

            if let Some(cwd) = call.args.get("cwd").and_then(Value::as_str) {
                process.current_dir(cwd);
            }

            let output = process.output().map_err(|error| error.to_string())?;

            if output.status.success() {
                Ok(success_result(
                    &call,
                    Some(serde_json::json!({
                        "stdout": String::from_utf8_lossy(&output.stdout),
                        "stderr": String::from_utf8_lossy(&output.stderr),
                        "exitCode": output.status.code(),
                    })),
                ))
            } else {
                Ok(error_result(
                    &call,
                    "error",
                    String::from_utf8_lossy(&output.stderr).to_string(),
                ))
            }
        }
        _ => Ok(error_result(
            &call,
            "unsupported",
            format!("unsupported desktop tool `{}`", call.tool_name),
        )),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = load_config();
    let tool_state = DesktopToolState {
        allowed_commands: Arc::new(config.allowed_commands.iter().cloned().collect()),
    };

    tauri::Builder::default()
        .manage(tool_state)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_desktop_tool])
        .setup(move |app| {
            if !cfg!(debug_assertions) {
                let server_config = config.clone();
                tauri::async_runtime::spawn(async move {
                    start_release_server(server_config).await;
                });
                std::thread::sleep(std::time::Duration::from_millis(150));
            }

            let url = local_server_url()
                .parse()
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("gpas-app")
                .inner_size(1440.0, 900.0)
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
