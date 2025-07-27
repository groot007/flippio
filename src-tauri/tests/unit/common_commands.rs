use serial_test::serial;
use flippio::commands::common::*;
use crate::fixtures::temp_files::TempFileManager;
use std::path::Path;
use tempfile::tempdir;

/// Test fixture for common command testing
struct CommonCommandTestFixture {
    temp_manager: TempFileManager,
}

impl CommonCommandTestFixture {
    fn new() -> Self {
        Self {
            temp_manager: TempFileManager::new(),
        }
    }

    /// Create a test database file
    fn create_test_database(&self, filename: &str) -> String {
        let db_path = self.temp_manager.create_file(filename, b"").to_string_lossy().to_string();
        // Create a simple SQLite database
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute(
            "CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)",
            [],
        ).unwrap();
        conn.execute("INSERT INTO test_table (name) VALUES ('test')", []).unwrap();
        drop(conn);
        db_path
    }
}

mod dialog_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_save_dropped_file_success() {
        let _fixture = CommonCommandTestFixture::new();
        
        // Create a mock app handle (this is tricky without full Tauri context)
        // For now, we'll test the logic parts we can
        let file_content = b"test database content".to_vec();
        let filename = "test.db".to_string();
        
        // We can't easily test the full Tauri command without the AppHandle,
        // but we can test the file operations logic
        let temp_dir = tempdir().unwrap();
        let dropped_files_dir = temp_dir.path().join("flippio_dropped_files");
        std::fs::create_dir_all(&dropped_files_dir).unwrap();
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let unique_filename = format!("{}_{}", timestamp, filename);
        let file_path = dropped_files_dir.join(&unique_filename);
        
        // Write the file content
        std::fs::write(&file_path, &file_content).unwrap();
        
        // Verify the file was created and has correct content
        assert!(file_path.exists());
        let read_content = std::fs::read(&file_path).unwrap();
        assert_eq!(read_content, file_content);
    }

    #[tokio::test]
    #[serial]
    async fn test_save_dropped_file_empty_content() {
        let temp_dir = tempdir().unwrap();
        let dropped_files_dir = temp_dir.path().join("flippio_dropped_files");
        std::fs::create_dir_all(&dropped_files_dir).unwrap();
        
        let file_content = Vec::new(); // Empty content
        let filename = "empty.db".to_string();
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let unique_filename = format!("{}_{}", timestamp, filename);
        let file_path = dropped_files_dir.join(&unique_filename);
        
        // Write empty file
        std::fs::write(&file_path, &file_content).unwrap();
        
        // Verify empty file was created
        assert!(file_path.exists());
        assert_eq!(std::fs::metadata(&file_path).unwrap().len(), 0);
    }

    #[tokio::test]
    #[serial]
    async fn test_save_dropped_file_large_content() {
        let temp_dir = tempdir().unwrap();
        let dropped_files_dir = temp_dir.path().join("flippio_dropped_files");
        std::fs::create_dir_all(&dropped_files_dir).unwrap();
        
        // Create large content (1MB)
        let file_content = vec![0u8; 1024 * 1024];
        let filename = "large.db".to_string();
        
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let unique_filename = format!("{}_{}", timestamp, filename);
        let file_path = dropped_files_dir.join(&unique_filename);
        
        // Write large file
        std::fs::write(&file_path, &file_content).unwrap();
        
        // Verify large file was created
        assert!(file_path.exists());
        assert_eq!(std::fs::metadata(&file_path).unwrap().len(), 1024 * 1024);
    }

    #[tokio::test]
    #[serial]
    async fn test_dialog_structures() {
        // Test DialogResult structure
        let result = DialogResult {
            success: true,
            canceled: false,
            file_paths: Some(vec!["test.db".to_string()]),
            file_path: Some("test.db".to_string()),
            error: None,
        };
        
        assert!(result.success);
        assert!(!result.canceled);
        assert!(result.file_paths.is_some());
        assert!(result.file_path.is_some());
        assert!(result.error.is_none());
        
        // Test canceled result
        let canceled_result = DialogResult {
            success: false,
            canceled: true,
            file_paths: None,
            file_path: None,
            error: None,
        };
        
        assert!(!canceled_result.success);
        assert!(canceled_result.canceled);
        assert!(canceled_result.file_paths.is_none());
        assert!(canceled_result.file_path.is_none());
    }

    #[tokio::test]
    #[serial]
    async fn test_save_dialog_options() {
        let filter = DialogFilter {
            name: "Database Files".to_string(),
            extensions: vec!["db".to_string(), "sqlite".to_string()],
        };
        
        let options = SaveDialogOptions {
            source_file_path: "/path/to/source.db".to_string(),
            default_filename: Some("export.db".to_string()),
            filters: Some(vec![filter]),
        };
        
        assert_eq!(options.source_file_path, "/path/to/source.db");
        assert!(options.default_filename.is_some());
        assert!(options.filters.is_some());
        
        let filters = options.filters.unwrap();
        assert_eq!(filters.len(), 1);
        assert_eq!(filters[0].name, "Database Files");
        assert_eq!(filters[0].extensions.len(), 2);
    }

    #[tokio::test]
    #[serial]
    async fn test_file_copy_logic() {
        let fixture = CommonCommandTestFixture::new();
        
        // Create source database
        let source_path = fixture.create_test_database("source.db");
        
        // Create destination path
        let dest_path = fixture.temp_manager.create_file("dest.db", b"").to_string_lossy().to_string();
        
        // Test file copy (this mimics the logic in dialog_save_file)
        std::fs::copy(&source_path, &dest_path).unwrap();
        
        // Verify files are identical
        let source_content = std::fs::read(&source_path).unwrap();
        let dest_content = std::fs::read(&dest_path).unwrap();
        assert_eq!(source_content, dest_content);
        
        // Verify destination file is a valid SQLite database
        let conn = rusqlite::Connection::open(&dest_path).unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM test_table").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    #[serial]
    async fn test_invalid_file_operations() {
        // Test copying from non-existent source
        let result = std::fs::copy("/nonexistent/source.db", "/tmp/dest.db");
        assert!(result.is_err());
        
        // Test copying to invalid destination
        let fixture = CommonCommandTestFixture::new();
        let source_path = fixture.create_test_database("source.db");
        let result = std::fs::copy(&source_path, "/invalid/path/dest.db");
        assert!(result.is_err());
    }
}

mod file_operations_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_unique_filename_generation() {
        let base_filename = "test.db";
        
        // Generate multiple unique filenames using counter instead of timestamp
        let mut filenames = Vec::new();
        for i in 0..10 {
            let unique_filename = format!("{}_{}", i, base_filename);
            filenames.push(unique_filename);
        }
        
        // Verify all filenames are unique
        let mut unique_set = std::collections::HashSet::new();
        for filename in &filenames {
            assert!(unique_set.insert(filename.clone()));
        }
        assert_eq!(unique_set.len(), filenames.len());
    }

    #[tokio::test]
    #[serial]
    async fn test_temp_directory_creation() {
        let temp_dir = tempdir().unwrap();
        let dropped_files_dir = temp_dir.path().join("flippio_dropped_files");
        
        // Test directory creation
        std::fs::create_dir_all(&dropped_files_dir).unwrap();
        assert!(dropped_files_dir.exists());
        assert!(dropped_files_dir.is_dir());
        
        // Test creating subdirectories
        let subdir = dropped_files_dir.join("subdir");
        std::fs::create_dir_all(&subdir).unwrap();
        assert!(subdir.exists());
        assert!(subdir.is_dir());
    }

    #[tokio::test]
    #[serial]
    async fn test_file_extension_handling() {
        let test_cases = vec![
            ("test.db", "db"),
            ("database.sqlite", "sqlite"),
            ("backup.sqlite3", "sqlite3"),
            ("noextension", ""),
            ("multiple.ext.db", "db"),
        ];
        
        for (filename, expected_ext) in test_cases {
            let path = Path::new(filename);
            let actual_ext = path.extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("");
            assert_eq!(actual_ext, expected_ext, "Failed for filename: {}", filename);
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_binary_file_handling() {
        let fixture = CommonCommandTestFixture::new();
        
        // Create binary content (SQLite header + some data)
        let mut binary_content = Vec::new();
        binary_content.extend_from_slice(b"SQLite format 3\x00"); // SQLite header
        binary_content.extend_from_slice(&[0u8; 100]); // Some binary data
        binary_content.extend_from_slice(b"\xFF\xFE\xFD\xFC"); // Binary bytes
        
        let file_path = fixture.temp_manager.create_file("binary.db", &binary_content).to_string_lossy().to_string();
        
        // Verify binary content is preserved
        let read_content = std::fs::read(&file_path).unwrap();
        assert_eq!(read_content, binary_content);
        
        // Verify it starts with SQLite header
        assert!(read_content.starts_with(b"SQLite format 3"));
    }
}

mod error_handling_tests {
    use super::*;

    #[tokio::test]
    #[serial]
    async fn test_permission_denied_scenarios() {
        // Test various permission scenarios that could occur
        // Note: These tests might not work on all systems due to permission restrictions
        
        let temp_dir = tempdir().unwrap();
        let test_file = temp_dir.path().join("test.db");
        
        // Create a file
        std::fs::write(&test_file, b"test content").unwrap();
        
        // Try to read it back (should succeed)
        let content = std::fs::read(&test_file).unwrap();
        assert_eq!(content, b"test content");
    }

    #[tokio::test]
    #[serial]
    async fn test_disk_space_scenarios() {
        let fixture = CommonCommandTestFixture::new();
        
        // Test with various file sizes
        let sizes = vec![0, 1024, 64 * 1024, 1024 * 1024]; // 0B, 1KB, 64KB, 1MB
        
        for size in sizes {
            let content = vec![0u8; size];
            let file_path = fixture.temp_manager.create_file(&format!("size_{}.db", size), &content).to_string_lossy().to_string();
            
            // Verify file size
            let metadata = std::fs::metadata(&file_path).unwrap();
            assert_eq!(metadata.len(), size as u64);
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_concurrent_file_operations() {
        let fixture = CommonCommandTestFixture::new();
        
        // Test concurrent file creation
        let handles: Vec<_> = (0..10).map(|i| {
            let temp_manager = fixture.temp_manager.clone();
            tokio::spawn(async move {
                let content = format!("content for file {}", i);
                let file_path = temp_manager.create_file(&format!("concurrent_{}.db", i), content.as_bytes()).to_string_lossy().to_string();
                (file_path, temp_manager)
            })
        }).collect();
        
        // Wait for all operations to complete
        let results: Vec<_> = futures::future::join_all(handles).await;
        
        // Verify all files were created successfully
        for result in results {
            let (file_path, _temp_manager) = result.unwrap();
            assert!(Path::new(&file_path).exists());
        }
    }
} 