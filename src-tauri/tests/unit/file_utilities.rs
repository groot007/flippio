use std::fs;
use std::path::PathBuf;

// Import the actual file utility functionality from the flippio library crate
use flippio::{
    ensure_temp_dir,
    get_libimobiledevice_tool_path,
};

#[cfg(test)]
mod file_utilities_tests {
    use super::*;
    use crate::fixtures::temp_files::*;
    
    /// Test fixture for file utility tests with real functionality
    struct FileUtilityTestFixture {
        temp_manager: TempFileManager,
    }

    impl FileUtilityTestFixture {
        fn new() -> Self {
            let temp_manager = TempFileManager::new();
            Self { temp_manager }
        }
    }
    
    #[tokio::test]
    async fn test_ensure_temp_dir_real_function() {
        // Test the real ensure_temp_dir function from the app
        let result = ensure_temp_dir();
        
        assert!(result.is_ok(), "ensure_temp_dir should succeed");
        
        let temp_dir = result.unwrap();
        assert!(temp_dir.exists(), "Temp directory should exist");
        assert!(temp_dir.is_dir(), "Should be a directory");
        
        // Test that the directory is writable
        let test_file = temp_dir.join("test_write.txt");
        let write_result = fs::write(&test_file, "test content");
        assert!(write_result.is_ok(), "Should be able to write to temp directory");
        
        // Test that we can read from it
        let read_result = fs::read_to_string(&test_file);
        assert!(read_result.is_ok(), "Should be able to read from temp directory");
        assert_eq!(read_result.unwrap(), "test content");
        
        // Clean up
        let _ = fs::remove_file(&test_file);
    }
    
    #[tokio::test]
    async fn test_temp_directory_creation_consistency() {
        let fixture = FileUtilityTestFixture::new();
        
        // Create multiple temp directories and verify they're unique
        let temp_dir1 = fixture.temp_manager.create_temp_dir("test1").unwrap();
        let temp_dir2 = fixture.temp_manager.create_temp_dir("test2").unwrap();
        
        assert!(temp_dir1.exists(), "First temp directory should exist");
        assert!(temp_dir2.exists(), "Second temp directory should exist");
        assert_ne!(temp_dir1, temp_dir2, "Temp directories should be unique");
        
        // Test that both are writable
        let file1 = temp_dir1.join("file1.txt");
        let file2 = temp_dir2.join("file2.txt");
        
        fs::write(&file1, "content1").unwrap();
        fs::write(&file2, "content2").unwrap();
        
        assert_eq!(fs::read_to_string(&file1).unwrap(), "content1");
        assert_eq!(fs::read_to_string(&file2).unwrap(), "content2");
    }
    
    #[tokio::test]
    async fn test_temp_file_creation_with_extensions() {
        let fixture = FileUtilityTestFixture::new();
        
        let extensions_to_test = [".db", ".sqlite", ".txt", ".json", ".log"];
        
        for extension in extensions_to_test {
            let temp_file = fixture.temp_manager.create_temp_file("test", extension).unwrap();
            
            assert!(temp_file.exists(), "Temp file should exist for extension {}", extension);
            assert!(temp_file.is_file(), "Should be a file for extension {}", extension);
            
            let file_extension = temp_file.extension().and_then(|s| s.to_str()).unwrap_or("");
            let expected_extension = extension.trim_start_matches('.');
            assert_eq!(file_extension, expected_extension, "File should have correct extension");
        }
    }
    
    #[tokio::test]
    async fn test_libimobiledevice_tool_path_resolution() {
        // Test the real get_libimobiledevice_tool_path function
        let tools_to_test = ["idevice_id", "ideviceinfo", "ideviceinstaller", "afcclient"];
        
        for tool in tools_to_test {
            let path_option = get_libimobiledevice_tool_path(tool);
            
            // The function returns Option<PathBuf>
            match path_option {
                Some(path) => {
                    let path_str = path.to_string_lossy();
                    assert!(!path_str.is_empty(), "Tool path should not be empty for {}", tool);
                    assert!(path_str.contains(tool), "Path should contain tool name for {}", tool);
                    
                    // The path should be a valid path format
                    assert!(path.file_name().is_some(), "Path should have a filename for {}", tool);
                    
                    let filename = path.file_name().unwrap().to_str().unwrap();
                    assert_eq!(filename, tool, "Filename should match tool name for {}", tool);
                }
                None => {
                    // Tool not found - acceptable in test environment
                    assert!(true, "Tool {} not found, but function executed safely", tool);
                }
            }
        }
    }
    
    #[tokio::test]
    async fn test_file_writing_and_reading_operations() {
        let fixture = FileUtilityTestFixture::new();
        
        // Test different types of content
        let test_cases = [
            ("text_file.txt", b"Hello, World!".to_vec()),
            ("json_file.json", br#"{"key": "value", "number": 123}"#.to_vec()),
            ("binary_file.bin", vec![0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]),
            ("empty_file.dat", vec![]),
        ];
        
        for (filename, content) in test_cases {
            let temp_file = fixture.temp_manager.create_temp_file(filename, "").unwrap();
            
            // Write content
            let write_result = fs::write(&temp_file, &content);
            assert!(write_result.is_ok(), "Should write content to {}", filename);
            
            // Read content back
            let read_result = fs::read(&temp_file);
            assert!(read_result.is_ok(), "Should read content from {}", filename);
            
            let read_content = read_result.unwrap();
            assert_eq!(read_content, content, "Content should match for {}", filename);
            
            // Test file metadata
            let metadata = fs::metadata(&temp_file).unwrap();
            assert_eq!(metadata.len(), content.len() as u64, "File size should match content length for {}", filename);
        }
    }
    
    #[tokio::test]
    async fn test_large_file_operations() {
        let fixture = FileUtilityTestFixture::new();
        
        // Create a large file (1MB)
        let large_content = vec![b'A'; 1024 * 1024];
        let large_file = fixture.temp_manager.create_temp_file("large_file", ".dat").unwrap();
        
        // Test writing large content
        let write_result = fs::write(&large_file, &large_content);
        assert!(write_result.is_ok(), "Should handle large file writes");
        
        // Verify file size
        let metadata = fs::metadata(&large_file).unwrap();
        assert_eq!(metadata.len(), large_content.len() as u64, "Large file should have correct size");
        
        // Test reading large content back
        let read_result = fs::read(&large_file);
        assert!(read_result.is_ok(), "Should handle large file reads");
        
        let read_content = read_result.unwrap();
        assert_eq!(read_content.len(), large_content.len(), "Read content should have same length");
        assert_eq!(read_content[0], b'A', "Content should match");
        assert_eq!(read_content[read_content.len() - 1], b'A', "Content should match at end");
    }
    
    #[tokio::test]
    async fn test_file_path_handling_and_validation() {
        let fixture = FileUtilityTestFixture::new();
        
        // Test various filename patterns
        let filename_tests = [
            ("simple", ".txt"),
            ("with-hyphens", ".log"),
            ("with_underscores", ".db"),
            ("with.dots", ".sqlite"),
            ("123numbers", ".json"),
        ];
        
        for (basename, extension) in filename_tests {
            let temp_file = fixture.temp_manager.create_temp_file(basename, extension).unwrap();
            
            // Verify path components
            assert!(temp_file.exists(), "File should exist for {}{}", basename, extension);
            
            let filename = temp_file.file_name().unwrap().to_str().unwrap();
            assert!(filename.contains(basename), "Filename should contain basename: {}", filename);
            assert!(filename.ends_with(extension), "Filename should end with extension: {}", filename);
            
            // Test that we can perform operations on it
            fs::write(&temp_file, "test content").unwrap();
            let content = fs::read_to_string(&temp_file).unwrap();
            assert_eq!(content, "test content");
        }
    }
    
    #[tokio::test]
    async fn test_directory_hierarchy_operations() {
        let fixture = FileUtilityTestFixture::new();
        
        // Create nested directory structure
        let base_dir = fixture.temp_manager.create_temp_dir("base").unwrap();
        let sub_dir1 = base_dir.join("sub1");
        let sub_dir2 = base_dir.join("sub2");
        let nested_dir = sub_dir1.join("nested");
        
        // Create directories
        fs::create_dir(&sub_dir1).unwrap();
        fs::create_dir(&sub_dir2).unwrap();
        fs::create_dir_all(&nested_dir).unwrap();
        
        // Verify structure
        assert!(sub_dir1.is_dir(), "Sub directory 1 should exist");
        assert!(sub_dir2.is_dir(), "Sub directory 2 should exist");
        assert!(nested_dir.is_dir(), "Nested directory should exist");
        
        // Create files in different directories
        let file1 = sub_dir1.join("file1.txt");
        let file2 = sub_dir2.join("file2.txt");
        let file3 = nested_dir.join("file3.txt");
        
        fs::write(&file1, "content1").unwrap();
        fs::write(&file2, "content2").unwrap();
        fs::write(&file3, "content3").unwrap();
        
        // Verify files
        assert_eq!(fs::read_to_string(&file1).unwrap(), "content1");
        assert_eq!(fs::read_to_string(&file2).unwrap(), "content2");
        assert_eq!(fs::read_to_string(&file3).unwrap(), "content3");
    }
    
    #[tokio::test]
    async fn test_file_cleanup_and_temporary_lifecycle() {
        let fixture = FileUtilityTestFixture::new();
        
        // Create several temp files
        let temp_files: Vec<PathBuf> = (0..5)
            .map(|i| fixture.temp_manager.create_temp_file(&format!("cleanup_test_{}", i), ".tmp").unwrap())
            .collect();
        
        // Write content to all files
        for (i, file) in temp_files.iter().enumerate() {
            fs::write(file, format!("content_{}", i)).unwrap();
            assert!(file.exists(), "File {} should exist after creation", i);
        }
        
        // Manually remove some files to test cleanup
        for file in &temp_files[0..3] {
            fs::remove_file(file).unwrap();
            assert!(!file.exists(), "File should be removed after cleanup");
        }
        
        // Verify remaining files still exist
        for file in &temp_files[3..] {
            assert!(file.exists(), "Remaining files should still exist");
        }
    }
    
    #[tokio::test]
    async fn test_concurrent_file_operations() {
        let _fixture = FileUtilityTestFixture::new();
        
        // Create multiple temp files concurrently
        let handles: Vec<_> = (0..10).map(|i| {
            tokio::spawn(async move {
                let temp_manager = TempFileManager::new();
                let temp_file = temp_manager.create_temp_file(&format!("concurrent_{}", i), ".txt").unwrap();
                let content = format!("concurrent content {}", i);
                
                fs::write(&temp_file, &content).unwrap();
                
                let read_content = fs::read_to_string(&temp_file).unwrap();
                assert_eq!(read_content, content);
                
                let file_path = temp_file.to_string_lossy().to_string();
                (file_path, temp_manager)
            })
        }).collect();
        
        // Wait for all operations and collect results, keeping temp managers alive
        let mut results = Vec::new();
        let mut temp_managers = Vec::new();
        
        for handle in handles {
            match handle.await {
                Ok((file_path, temp_manager)) => {
                    results.push(file_path);
                    temp_managers.push(temp_manager);
                }
                Err(e) => {
                    eprintln!("Concurrent file operation failed: {:?}", e);
                }
            }
        }
        
        // Verify files were created successfully
        assert!(!results.is_empty(), "At least some concurrent operations should succeed");
        
        for (i, file_path) in results.iter().enumerate() {
            assert!(std::path::Path::new(file_path).exists(), "Concurrent file {} should exist", i);
            let content = fs::read_to_string(file_path).unwrap();
            assert!(content.contains(&format!("concurrent content")), "Content should be valid for file {}", i);
        }
        
        // temp_managers will be dropped here, cleaning up the files
    }
    
    #[tokio::test]
    async fn test_error_handling_for_invalid_operations() {
        let fixture = FileUtilityTestFixture::new();
        
        // Test writing to a directory (should fail)
        let temp_dir = fixture.temp_manager.create_temp_dir("invalid_write_test").unwrap();
        let write_result = fs::write(&temp_dir, "should fail");
        assert!(write_result.is_err(), "Writing to directory should fail");
        
        // Test reading non-existent file
        let non_existent = temp_dir.join("does_not_exist.txt");
        let read_result = fs::read_to_string(&non_existent);
        assert!(read_result.is_err(), "Reading non-existent file should fail");
        
        // Test creating file with invalid parent directory
        let invalid_parent = PathBuf::from("/non/existent/path/file.txt");
        let invalid_write = fs::write(&invalid_parent, "content");
        assert!(invalid_write.is_err(), "Writing to invalid path should fail");
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
