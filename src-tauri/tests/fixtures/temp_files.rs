use tempfile::TempDir;
use std::path::PathBuf;
use std::fs;
use std::sync::Arc;

/// Create temporary files and directories for testing
pub struct TempFileManager {
    pub temp_dir: Arc<TempDir>,
}

impl Clone for TempFileManager {
    fn clone(&self) -> Self {
        Self {
            temp_dir: Arc::clone(&self.temp_dir),
        }
    }
}

impl TempFileManager {
    pub fn new() -> Self {
        Self {
            temp_dir: Arc::new(tempfile::tempdir().unwrap()),
        }
    }
    
    pub fn create_file(&self, name: &str, content: &[u8]) -> PathBuf {
        let file_path = self.temp_dir.path().join(name);
        fs::write(&file_path, content).unwrap();
        file_path
    }
    
    // Create a temp file with name and extension
    pub fn create_temp_file(&self, prefix: &str, suffix: &str) -> Result<PathBuf, std::io::Error> {
        let filename = format!("{}{}", prefix, suffix);
        let file_path = self.temp_dir.path().join(filename);
        fs::write(&file_path, b"")?;
        Ok(file_path)
    }
    
    pub fn create_dir(&self, name: &str) -> PathBuf {
        let dir_path = self.temp_dir.path().join(name);
        fs::create_dir_all(&dir_path).unwrap();
        dir_path
    }
    
    // Create a temp directory
    pub fn create_temp_dir(&self, prefix: &str) -> Result<PathBuf, std::io::Error> {
        let dir_path = self.temp_dir.path().join(prefix);
        fs::create_dir_all(&dir_path)?;
        Ok(dir_path)
    }
    
    pub fn get_path(&self, name: &str) -> PathBuf {
        self.temp_dir.path().join(name)
    }
    
    pub fn temp_path(&self) -> &std::path::Path {
        self.temp_dir.path()
    }
}
