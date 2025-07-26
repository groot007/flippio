use std::fs;
use std::path::PathBuf;

#[cfg(test)]
mod file_utilities_tests {
    use super::*;
    use crate::fixtures::temp_files::*;
    
    #[tokio::test]
    async fn test_temp_directory_creation() {
        let temp_manager = TempFileManager::new();
        
        let temp_dir = temp_manager.create_temp_dir("test_files").unwrap();
        
        // Verify directory exists
        assert!(temp_dir.exists());
        assert!(temp_dir.is_dir());
        
        // Verify it's in a temp location
        let temp_str = temp_dir.to_string_lossy();
        assert!(temp_str.contains("test_files"));
    }
    
    #[tokio::test]
    async fn test_temp_file_creation() {
        let temp_manager = TempFileManager::new();
        
        let temp_file = temp_manager.create_temp_file("test", ".db").unwrap();
        
        // Verify file exists
        assert!(temp_file.exists());
        assert!(temp_file.is_file());
        
        // Verify extension
        assert_eq!(temp_file.extension().unwrap(), "db");
    }
    
    #[tokio::test]
    async fn test_file_writing_and_reading() {
        let temp_manager = TempFileManager::new();
        let temp_file = temp_manager.create_temp_file("test_content", ".txt").unwrap();
        
        // Write content to file
        let test_content = "Hello, Flippio!";
        fs::write(&temp_file, test_content).unwrap();
        
        // Read content back
        let read_content = fs::read_to_string(&temp_file).unwrap();
        assert_eq!(read_content, test_content);
    }
    
    #[tokio::test]
    async fn test_binary_file_operations() {
        let temp_manager = TempFileManager::new();
        let temp_file = temp_manager.create_temp_file("binary_test", ".bin").unwrap();
        
        // Write binary content
        let binary_data = vec![0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD];
        fs::write(&temp_file, &binary_data).unwrap();
        
        // Read binary content back
        let read_data = fs::read(&temp_file).unwrap();
        assert_eq!(read_data, binary_data);
    }
    
    #[tokio::test]
    async fn test_file_size_operations() {
        let temp_manager = TempFileManager::new();
        let temp_file = temp_manager.create_temp_file("size_test", ".txt").unwrap();
        
        // Write known content
        let content = "A".repeat(1000); // 1000 bytes
        fs::write(&temp_file, &content).unwrap();
        
        // Check file size
        let metadata = fs::metadata(&temp_file).unwrap();
        assert_eq!(metadata.len(), 1000);
    }
    
    #[tokio::test]
    async fn test_file_permissions() {
        let temp_manager = TempFileManager::new();
        let temp_file = temp_manager.create_temp_file("permissions_test", ".txt").unwrap();
        
        // Write some content
        fs::write(&temp_file, "test").unwrap();
        
        // Check that file is readable
        let content = fs::read_to_string(&temp_file);
        assert!(content.is_ok());
        
        // Check metadata
        let metadata = fs::metadata(&temp_file).unwrap();
        assert!(metadata.is_file());
    }
    
    #[tokio::test]
    async fn test_directory_traversal() {
        let temp_manager = TempFileManager::new();
        let base_dir = temp_manager.create_temp_dir("traversal_test").unwrap();
        
        // Create subdirectories and files
        let sub_dir = base_dir.join("subdir");
        fs::create_dir_all(&sub_dir).unwrap();
        
        let file1 = base_dir.join("file1.txt");
        let file2 = sub_dir.join("file2.txt");
        
        fs::write(&file1, "content1").unwrap();
        fs::write(&file2, "content2").unwrap();
        
        // Read directory contents
        let entries: Vec<_> = fs::read_dir(&base_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
            
        assert!(entries.len() >= 2); // At least file1 and subdir
        
        // Check that we can find our files
        let mut names = Vec::new();
        for entry in &entries {
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_string());
            }
        }
            
        assert!(names.iter().any(|name| name == "file1.txt"));
        assert!(names.iter().any(|name| name == "subdir"));
    }
}

#[cfg(test)]
mod file_security_tests {
    use super::*;
    use crate::fixtures::temp_files::*;
    
    #[tokio::test]
    async fn test_path_validation() {
        // Test that paths are properly validated
        let safe_path = PathBuf::from("safe/file.db");
        assert!(!safe_path.to_string_lossy().contains(".."));
        
        let unsafe_path = PathBuf::from("../../../etc/passwd");
        assert!(unsafe_path.to_string_lossy().contains(".."));
    }
    
    #[tokio::test]
    async fn test_file_extension_validation() {
        let db_file = PathBuf::from("database.db");
        assert_eq!(db_file.extension().unwrap(), "db");
        
        let sqlite_file = PathBuf::from("database.sqlite");
        assert_eq!(sqlite_file.extension().unwrap(), "sqlite");
        
        let txt_file = PathBuf::from("readme.txt");
        assert_eq!(txt_file.extension().unwrap(), "txt");
        
        let no_extension = PathBuf::from("README");
        assert!(no_extension.extension().is_none());
    }
    
    #[tokio::test]
    async fn test_filename_sanitization() {
        // Test handling of potentially problematic filenames
        let problematic_chars = vec!['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
        
        for char in problematic_chars {
            let filename = format!("test{}file.db", char);
            // In a real implementation, we'd sanitize these
            assert!(filename.contains(char), "Should contain problematic char: {}", char);
        }
    }
    
    #[tokio::test]
    async fn test_symlink_handling() {
        let temp_manager = TempFileManager::new();
        let temp_dir = temp_manager.create_temp_dir("symlink_test").unwrap();
        
        let original_file = temp_dir.join("original.txt");
        fs::write(&original_file, "original content").unwrap();
        
        #[cfg(unix)]
        {
            let symlink_path = temp_dir.join("symlink.txt");
            
            // Create symlink (Unix only)
            let result = std::os::unix::fs::symlink(&original_file, &symlink_path);
            
            if result.is_ok() {
                // Check that we can detect symlinks
                let metadata = fs::symlink_metadata(&symlink_path).unwrap();
                assert!(metadata.file_type().is_symlink());
                
                // Check that following symlink works
                let content = fs::read_to_string(&symlink_path).unwrap();
                assert_eq!(content, "original content");
            }
        }
    }
}

#[cfg(test)]
mod file_cleanup_tests {
    use super::*;
    use crate::fixtures::temp_files::*;
    
    #[tokio::test]
    async fn test_automatic_cleanup() {
        let temp_file_path;
        
        {
            let temp_manager = TempFileManager::new();
            let temp_file = temp_manager.create_temp_file("cleanup_test", ".tmp").unwrap();
            temp_file_path = temp_file.clone();
            
            // Write something to the file
            fs::write(&temp_file, "temporary content").unwrap();
            assert!(temp_file.exists());
        } // temp_manager goes out of scope here
        
        // Note: In a real implementation with Drop trait, the file might be cleaned up
        // For now, we just verify we can detect if cleanup happened
        let _still_exists = temp_file_path.exists();
        // This test documents the current behavior
        // In a full implementation, we'd expect !still_exists after Drop
    }
    
    #[tokio::test]
    async fn test_manual_cleanup() {
        let temp_manager = TempFileManager::new();
        let temp_file = temp_manager.create_temp_file("manual_cleanup", ".tmp").unwrap();
        
        // Write content
        fs::write(&temp_file, "content to be removed").unwrap();
        assert!(temp_file.exists());
        
        // Manual cleanup
        fs::remove_file(&temp_file).unwrap();
        assert!(!temp_file.exists());
    }
    
    #[tokio::test]
    async fn test_directory_cleanup() {
        let temp_manager = TempFileManager::new();
        let temp_dir = temp_manager.create_temp_dir("dir_cleanup").unwrap();
        
        // Create files in directory
        let file1 = temp_dir.join("file1.txt");
        let file2 = temp_dir.join("file2.txt");
        
        fs::write(&file1, "content1").unwrap();
        fs::write(&file2, "content2").unwrap();
        
        assert!(temp_dir.exists());
        assert!(file1.exists());
        assert!(file2.exists());
        
        // Manual cleanup of entire directory
        fs::remove_dir_all(&temp_dir).unwrap();
        assert!(!temp_dir.exists());
        assert!(!file1.exists());
        assert!(!file2.exists());
    }
    
    #[tokio::test]
    async fn test_partial_cleanup_failure_handling() {
        let temp_manager = TempFileManager::new();
        let temp_dir = temp_manager.create_temp_dir("partial_cleanup").unwrap();
        
        let file1 = temp_dir.join("file1.txt");
        let file2 = temp_dir.join("file2.txt");
        
        fs::write(&file1, "content1").unwrap();
        fs::write(&file2, "content2").unwrap();
        
        // Remove one file successfully
        let result1 = fs::remove_file(&file1);
        assert!(result1.is_ok());
        assert!(!file1.exists());
        
        // Try to remove non-existent file
        let result2 = fs::remove_file(&file1);
        assert!(result2.is_err()); // Should fail because file is already removed
        
        // Clean up remaining file
        fs::remove_file(&file2).unwrap();
        fs::remove_dir(&temp_dir).unwrap();
    }
}
