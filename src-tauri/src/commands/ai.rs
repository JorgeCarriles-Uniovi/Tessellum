use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use tauri::{command, AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiProviderConfig {
    pub kind: String,          // "ollama" | "openai"
    pub base_url: String,      // e.g. "http://localhost:11434" or "https://api.openai.com"
    pub api_key: Option<String>,
    pub model: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct AiTokenEvent {
    pub request_id: String,
    pub token: String,
    pub done: bool,
    pub error: Option<String>,
}

// ----- Ollama streaming -----

fn stream_ollama(
    app: &AppHandle,
    prompt: &str,
    context: &str,
    config: &AiProviderConfig,
    request_id: &str,
) -> Result<(), String> {
    #[derive(Serialize)]
    struct OllamaRequest<'a> {
        model: &'a str,
        prompt: String,
        stream: bool,
    }

    #[derive(Deserialize)]
    struct OllamaChunk {
        response: String,
        done: bool,
    }

    let full_prompt = if context.is_empty() {
        prompt.to_string()
    } else {
        format!("Context:\n{context}\n\nInstruction:\n{prompt}")
    };

    let url = format!("{}/api/generate", config.base_url.trim_end_matches('/'));
    let body = serde_json::to_string(&OllamaRequest {
        model: &config.model,
        prompt: full_prompt,
        stream: true,
    })
    .map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .map_err(|e| format!("Ollama request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v["error"].as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(format!("Ollama error: {msg}"));
    }

    let reader = BufReader::new(resp);
    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if line.is_empty() {
            continue;
        }
        if let Ok(chunk) = serde_json::from_str::<OllamaChunk>(&line) {
            let done = chunk.done;
            let _ = app.emit(
                "ai-token",
                AiTokenEvent {
                    request_id: request_id.to_string(),
                    token: chunk.response,
                    done,
                    error: None,
                },
            );
            if done {
                break;
            }
        }
    }
    Ok(())
}

// ----- OpenAI streaming -----

fn stream_openai(
    app: &AppHandle,
    prompt: &str,
    context: &str,
    config: &AiProviderConfig,
    request_id: &str,
) -> Result<(), String> {
    #[derive(Serialize)]
    struct Message<'a> {
        role: &'a str,
        content: String,
    }

    #[derive(Serialize)]
    struct OpenAiRequest<'a> {
        model: &'a str,
        messages: Vec<Message<'a>>,
        stream: bool,
    }

    let user_content = if context.is_empty() {
        prompt.to_string()
    } else {
        format!("Context:\n{context}\n\nInstruction:\n{prompt}")
    };

    let api_key = config
        .api_key
        .as_deref()
        .filter(|k| !k.is_empty())
        .ok_or_else(|| "OpenAI API key is required but not configured".to_string())?;

    let url = format!(
        "{}/v1/chat/completions",
        config.base_url.trim_end_matches('/')
    );
    let body = serde_json::to_string(&OpenAiRequest {
        model: &config.model,
        messages: vec![Message {
            role: "user",
            content: user_content,
        }],
        stream: true,
    })
    .map_err(|e| e.to_string())?;

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {api_key}"))
        .body(body)
        .send()
        .map_err(|e| format!("OpenAI request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v["error"]["message"].as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(format!("OpenAI error: {msg}"));
    }

    let reader = BufReader::new(resp);
    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if line.is_empty() || line == "data: [DONE]" {
            if line == "data: [DONE]" {
                let _ = app.emit(
                    "ai-token",
                    AiTokenEvent {
                        request_id: request_id.to_string(),
                        token: String::new(),
                        done: true,
                        error: None,
                    },
                );
            }
            continue;
        }
        let json_str = line.strip_prefix("data: ").unwrap_or(&line);
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
            let token = value["choices"][0]["delta"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string();
            if !token.is_empty() {
                let _ = app.emit(
                    "ai-token",
                    AiTokenEvent {
                        request_id: request_id.to_string(),
                        token,
                        done: false,
                        error: None,
                    },
                );
            }
        }
    }
    Ok(())
}

// ----- Tauri command -----

#[command]
pub async fn ai_generate(
    app: AppHandle,
    prompt: String,
    context: String,
    provider_config: AiProviderConfig,
    request_id: String,
) -> Result<(), String> {
    let app_clone = app.clone();
    let req_id = request_id.clone();
    let result = tokio::task::spawn_blocking(move || {
        match provider_config.kind.as_str() {
            "openai" => stream_openai(&app_clone, &prompt, &context, &provider_config, &req_id),
            _ => stream_ollama(&app_clone, &prompt, &context, &provider_config, &req_id),
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Err(err) = result {
        let _ = app.emit(
            "ai-token",
            AiTokenEvent {
                request_id,
                token: String::new(),
                done: true,
                error: Some(err.clone()),
            },
        );
        return Err(err);
    }
    Ok(())
}
