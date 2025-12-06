use serde::Serialize;
use specta::Type;

#[derive(Debug, thiserror::Error, Serialize, Type)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    #[error("IO Error: {0}")]
    Io(String),
    #[error("Network Error: {0}")]
    Network(String),
    #[error("Serialization Error: {0}")]
    Serialization(String),
    #[error("Audio Error: {0}")]
    Audio(String),
    #[error("Validation Error: {0}")]
    Validation(String),
    #[error("Not Found: {0}")]
    NotFound(String),
    #[error("Logic Error: {0}")]
    Logic(String),
    #[error("Unexpected Error: {0}")]
    Unexpected(String),
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::Io(error.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(error: reqwest::Error) -> Self {
        AppError::Network(error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        AppError::Serialization(error.to_string())
    }
}

impl From<String> for AppError {
    fn from(error: String) -> Self {
        AppError::Unexpected(error)
    }
}

impl From<&str> for AppError {
    fn from(error: &str) -> Self {
        AppError::Unexpected(error.to_string())
    }
}
