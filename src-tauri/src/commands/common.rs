// Common commands module
// Implements file dialog and other common IPC commands

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogResult {
    pub canceled: bool,
    pub file_paths: Option<Vec<String>>,
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveDialogOptions {
    pub db_file_path: String,
    pub default_path: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

fn is_exportable_log_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| {
            (name.starts_with("frontend") || name.starts_with("backend")) && name.ends_with(".log")
        })
        .unwrap_or(false)
}

fn source_label(source: &str) -> &'static str {
    match source {
        "frontend" => "🖥 frontend",
        "backend" => "⚙ backend",
        _ => "backend",
    }
}

fn normalize_log_line(line: &str, source: &str) -> String {
    let frontend_label = source_label("frontend");
    let backend_label = source_label("backend");

    if line.contains(frontend_label) || line.contains(backend_label) {
        line.to_string()
    } else if line.contains("[frontend]") {
        line.replace("[frontend]", &format!("[{}]", frontend_label))
    } else if line.contains("[backend]") {
        line.replace("[backend]", &format!("[{}]", backend_label))
    } else {
        format!("[{}] {}", source_label(source), line)
    }
}

fn collect_merged_logs(log_dir: &Path) -> Result<String, String> {
    let mut entries: Vec<String> = Vec::new();

    if !log_dir.exists() {
        return Ok(String::new());
    }

    let read_dir =
        std::fs::read_dir(log_dir).map_err(|e| format!("Failed to read log directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read log entry: {}", e))?;
        let path = entry.path();

        if !path.is_file() || !is_exportable_log_file(&path) {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        let source = if file_name.starts_with("frontend") {
            "frontend"
        } else {
            "backend"
        };

        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read log file {}: {}", path.display(), e))?;

        for line in content.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                entries.push(normalize_log_line(trimmed, source));
            }
        }
    }

    entries.sort();
    Ok(entries.join("\n"))
}

async fn prompt_save_path(
    app_handle: &tauri::AppHandle,
    default_name: &str,
    filters: &[(&str, &[&str])],
) -> Result<Option<PathBuf>, String> {
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();
    let mut dialog = app_handle.dialog().file().set_file_name(default_name);

    for (name, extensions) in filters {
        dialog = dialog.add_filter(*name, extensions);
    }

    dialog.save_file(move |file_path| {
        let _ = tx.send(file_path);
    });

    match rx.await {
        Ok(Some(path)) => Ok(Some(
            path.into_path()
                .map_err(|_| "Invalid save path selected".to_string())?,
        )),
        Ok(None) | Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn dialog_select_file(
    app_handle: tauri::AppHandle,
    _options: Option<serde_json::Value>,
) -> Result<DialogResult, String> {
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();

    let mut dialog = app_handle.dialog().file();

    // Add database file filters
    dialog = dialog.add_filter("Database Files", &["db", "sqlite", "sqlite3", "db3"]);
    dialog = dialog.add_filter("All Files", &["*"]);

    dialog.pick_file(move |file_path| {
        let _ = tx.send(file_path);
    });

    // Wait for the user to select a file or cancel
    match rx.await {
        Ok(Some(path)) => Ok(DialogResult {
            canceled: false,
            file_paths: Some(vec![path.to_string()]),
            file_path: Some(path.to_string()),
        }),
        Ok(None) | Err(_) => Ok(DialogResult {
            canceled: true,
            file_paths: None,
            file_path: None,
        }),
    }
}

#[tauri::command]
pub async fn save_dropped_file(
    app_handle: tauri::AppHandle,
    file_content: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    use std::fs;
    use std::io::Write;

    // Create a temporary directory for dropped files
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get temp directory: {}", e))?;

    let dropped_files_dir = temp_dir.join("flippio_dropped_files");
    fs::create_dir_all(&dropped_files_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Create a unique filename to avoid conflicts
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_else(|_| {
            log::warn!("System time before Unix epoch, using fallback timestamp");
            std::time::Duration::from_secs(0)
        })
        .as_secs();
    let unique_filename = format!("{}_{}", timestamp, filename);
    let file_path = dropped_files_dir.join(&unique_filename);

    // Write the file content
    let mut file =
        fs::File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&file_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn dialog_save_file(
    app_handle: tauri::AppHandle,
    options: SaveDialogOptions,
) -> Result<Option<String>, String> {
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();

    let mut dialog = app_handle.dialog().file();

    // Set default filename from options if provided
    if let Some(default_path) = &options.default_path {
        dialog = dialog.set_file_name(default_path);
    }

    // Set filters if provided
    if let Some(filters) = &options.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(&filter.name, &extensions);
        }
    }

    dialog.save_file(move |file_path| {
        let _ = tx.send(file_path);
    });

    // Wait for the user to select a save location or cancel
    match rx.await {
        Ok(Some(path)) => {
            // Copy the database file to the selected location
            let source_path = Path::new(&options.db_file_path);
            let dest_string = path.to_string();
            let dest_path = Path::new(&dest_string);

            std::fs::copy(source_path, dest_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;

            Ok(Some(path.to_string()))
        }
        Ok(None) | Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn export_logs(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get log directory: {}", e))?;
    let merged_logs = collect_merged_logs(&log_dir)?;
    let timestamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S");
    let default_name = format!("flippio-logs-{}.txt", timestamp);

    let save_path = prompt_save_path(
        &app_handle,
        &default_name,
        &[("Text Files", &["txt"]), ("All Files", &["*"])],
    )
    .await?;

    let Some(save_path) = save_path else {
        return Ok(None);
    };

    std::fs::write(&save_path, merged_logs)
        .map_err(|e| format!("Failed to write exported logs: {}", e))?;

    Ok(Some(save_path.to_string_lossy().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dialog_result_creation() {
        let result = DialogResult {
            canceled: false,
            file_paths: Some(vec!["path1.db".to_string(), "path2.db".to_string()]),
            file_path: Some("selected.db".to_string()),
        };

        assert!(!result.canceled);
        assert_eq!(result.file_paths.as_ref().unwrap().len(), 2);
        assert_eq!(result.file_path.as_ref().unwrap(), "selected.db");
    }

    #[test]
    fn test_dialog_result_canceled() {
        let result = DialogResult {
            canceled: true,
            file_paths: None,
            file_path: None,
        };

        assert!(result.canceled);
        assert!(result.file_paths.is_none());
        assert!(result.file_path.is_none());
    }

    #[test]
    fn test_save_dialog_options_creation() {
        let filter = DialogFilter {
            name: "Database Files".to_string(),
            extensions: vec!["db".to_string(), "sqlite".to_string()],
        };

        let options = SaveDialogOptions {
            db_file_path: "/path/to/database.db".to_string(),
            default_path: Some("/default/path".to_string()),
            filters: Some(vec![filter]),
        };

        assert_eq!(options.db_file_path, "/path/to/database.db");
        assert!(options.default_path.is_some());
        assert!(options.filters.is_some());
        assert_eq!(options.filters.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn test_dialog_filter_creation() {
        let filter = DialogFilter {
            name: "All Files".to_string(),
            extensions: vec!["*".to_string()],
        };

        assert_eq!(filter.name, "All Files");
        assert_eq!(filter.extensions.len(), 1);
        assert_eq!(filter.extensions[0], "*");
    }

    #[test]
    fn test_dialog_filter_database_extensions() {
        let filter = DialogFilter {
            name: "Database Files".to_string(),
            extensions: vec![
                "db".to_string(),
                "sqlite".to_string(),
                "sqlite3".to_string(),
                "db3".to_string(),
            ],
        };

        assert_eq!(filter.name, "Database Files");
        assert_eq!(filter.extensions.len(), 4);
        assert!(filter.extensions.contains(&"db".to_string()));
        assert!(filter.extensions.contains(&"sqlite".to_string()));
        assert!(filter.extensions.contains(&"sqlite3".to_string()));
        assert!(filter.extensions.contains(&"db3".to_string()));
    }

    #[test]
    fn test_save_dialog_options_without_defaults() {
        let options = SaveDialogOptions {
            db_file_path: "test.db".to_string(),
            default_path: None,
            filters: None,
        };

        assert_eq!(options.db_file_path, "test.db");
        assert!(options.default_path.is_none());
        assert!(options.filters.is_none());
    }

    #[test]
    fn test_serde_serialization() -> Result<(), serde_json::Error> {
        let result = DialogResult {
            canceled: false,
            file_paths: Some(vec!["test.db".to_string()]),
            file_path: Some("test.db".to_string()),
        };

        // Test serialization
        let json = serde_json::to_string(&result)?;
        assert!(json.contains("canceled"));
        assert!(json.contains("file_paths"));
        assert!(json.contains("file_path"));

        // Test deserialization
        let deserialized: DialogResult = serde_json::from_str(&json)?;
        assert_eq!(deserialized.canceled, result.canceled);
        assert_eq!(deserialized.file_paths, result.file_paths);
        assert_eq!(deserialized.file_path, result.file_path);

        Ok(())
    }

    #[test]
    fn test_multiple_filters() {
        let filter1 = DialogFilter {
            name: "Database Files".to_string(),
            extensions: vec!["db".to_string(), "sqlite".to_string()],
        };

        let filter2 = DialogFilter {
            name: "All Files".to_string(),
            extensions: vec!["*".to_string()],
        };

        let options = SaveDialogOptions {
            db_file_path: "test.db".to_string(),
            default_path: None,
            filters: Some(vec![filter1, filter2]),
        };

        let filters = options.filters.unwrap();
        assert_eq!(filters.len(), 2);
        assert_eq!(filters[0].name, "Database Files");
        assert_eq!(filters[1].name, "All Files");
    }

    #[test]
    fn test_empty_extensions() {
        let filter = DialogFilter {
            name: "Test Filter".to_string(),
            extensions: vec![],
        };

        assert_eq!(filter.name, "Test Filter");
        assert!(filter.extensions.is_empty());
    }

    #[test]
    fn test_normalize_log_line_preserves_existing_source_label() {
        let line = "2026-01-01T10:00:00.000Z [INFO] [🖥 frontend] hello";
        assert_eq!(normalize_log_line(line, "frontend"), line);
    }

    #[test]
    fn test_normalize_log_line_adds_source_label() {
        let line = "2026-01-01T10:00:00.000Z [INFO] hello";
        assert_eq!(
            normalize_log_line(line, "backend"),
            "[⚙ backend] 2026-01-01T10:00:00.000Z [INFO] hello"
        );
    }

    #[test]
    fn test_collect_merged_logs_sorts_and_merges() {
        let temp_dir = tempfile::tempdir().unwrap();
        std::fs::write(
            temp_dir.path().join("frontend.log"),
            "2026-01-01T10:00:01.000Z [INFO] [🖥 frontend] ui\n",
        )
        .unwrap();
        std::fs::write(
            temp_dir.path().join("backend.log"),
            "2026-01-01T10:00:00.000Z [INFO] [⚙ backend] api\n",
        )
        .unwrap();

        let merged = collect_merged_logs(temp_dir.path()).unwrap();
        assert_eq!(
            merged,
            "2026-01-01T10:00:00.000Z [INFO] [⚙ backend] api\n2026-01-01T10:00:01.000Z [INFO] [🖥 frontend] ui"
        );
    }
}
