use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, State};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    pub success: bool,
    pub total_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub primary_key: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseResult {
    pub success: bool,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
}

#[command]
pub async fn open_database(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<DatabaseResult, String> {
    println!("🔍 DEBUG: Opening database: {}", file_path);
    
    if !std::path::Path::new(&file_path).exists() {
        let error_msg = format!("Database file does not exist: {}", file_path);
        println!("🔍 DEBUG: {}", error_msg);
        return Err(error_msg);
    }
    
    let connection = Connection::open(&file_path)
        .map_err(|e| {
            let error_msg = format!("Failed to open database: {}", e);
            println!("🔍 DEBUG: {}", error_msg);
            error_msg
        })?;
    
    println!("🔍 DEBUG: Database opened successfully");
    
    // Store the connection in the app state
    let mut db_connection = state.db_connection.lock().unwrap();
    *db_connection = Some(connection);
    
    Ok(DatabaseResult {
        success: true,
        message: Some(format!("Database opened successfully: {}", file_path)),
        data: None,
    })
}

#[command]
pub async fn get_tables(state: State<'_, AppState>) -> Result<Vec<HashMap<String, String>>, String> {
    println!("🔍 DEBUG: Getting database tables...");
    let db_connection = state.db_connection.lock().unwrap();
    let conn = db_connection
        .as_ref()
        .ok_or_else(|| {
            println!("🔍 DEBUG: No database connection available");
            "No database connection available".to_string()
        })?;
    
    println!("🔍 DEBUG: Executing table query...");
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .map_err(|e| {
            println!("🔍 DEBUG: Failed to prepare statement: {}", e);
            format!("Failed to prepare statement: {}", e)
        })?;
    
    let table_names = stmt
        .query_map([], |row| {
            Ok(row.get::<_, String>(0)?)
        })
        .map_err(|e| {
            println!("🔍 DEBUG: Failed to execute query: {}", e);
            format!("Failed to execute query: {}", e)
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| {
            println!("🔍 DEBUG: Failed to collect results: {}", e);
            format!("Failed to collect results: {}", e)
        })?;

    // return in format [{name: "table1"}, {name: "table2"}, ...
    let tables: Vec<HashMap<String, String>> = table_names.into_iter().map(|name| {
        let mut map = HashMap::new();
        map.insert("name".to_string(), name);
        map
    }).collect();

    println!("🔍 DEBUG: Found {} tables: {:?}", tables.len(), tables);
    Ok(tables)
}

#[command]
pub async fn get_table_data(
    state: State<'_, AppState>,
    table_name: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<TableInfo, String> {
    let db_connection = state.db_connection.lock().unwrap();
    let conn = db_connection
        .as_ref()
        .ok_or("No database connection available")?;
    
    // Get column information
    let mut columns = Vec::new();
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table_name))
        .map_err(|e| format!("Failed to get table info: {}", e))?;
    
    let column_rows = stmt
        .query_map([], |row| {
            Ok(ColumnInfo {
                name: row.get(1)?,
                data_type: row.get(2)?,
                nullable: row.get::<_, i32>(3)? == 0,
                primary_key: row.get::<_, i32>(5)? == 1,
            })
        })
        .map_err(|e| format!("Failed to get column info: {}", e))?;
    
    for column in column_rows {
        columns.push(column.map_err(|e| format!("Failed to process column: {}", e))?);
    }
    
    // Get total count
    let mut count_stmt = conn
        .prepare(&format!("SELECT COUNT(*) FROM {}", table_name))
        .map_err(|e| format!("Failed to prepare count query: {}", e))?;
    
    let total_count: usize = count_stmt
        .query_row([], |row| Ok(row.get::<_, i64>(0)? as usize))
        .map_err(|e| format!("Failed to get row count: {}", e))?;
    
    // Get data with limit and offset
    let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
    let offset_clause = offset.map(|o| format!(" OFFSET {}", o)).unwrap_or_default();
    
    let query = format!("SELECT * FROM {}{}{}", table_name, limit_clause, offset_clause);
    let mut data_stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare data query: {}", e))?;
    
    let mut rows = Vec::new();
    let data_rows = data_stmt
        .query_map([], |row| {
            let mut row_data = HashMap::new();
            for (i, column) in columns.iter().enumerate() {
                let value: serde_json::Value = match row.get_ref(i) {
                    Ok(value_ref) => match value_ref {
                        rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                        rusqlite::types::ValueRef::Integer(i) => serde_json::Value::Number(i.into()),
                        rusqlite::types::ValueRef::Real(f) => {
                            serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or_else(|| serde_json::Number::from(0)))
                        }
                        rusqlite::types::ValueRef::Text(s) => {
                            serde_json::Value::String(String::from_utf8_lossy(s).to_string())
                        }
                        rusqlite::types::ValueRef::Blob(b) => {
                            serde_json::Value::String(format!("BLOB({} bytes)", b.len()))
                        }
                    },
                    Err(_) => serde_json::Value::Null,
                };
                row_data.insert(column.name.clone(), value);
            }
            Ok(row_data)
        })
        .map_err(|e| format!("Failed to query data: {}", e))?;
    
    for row in data_rows {
        rows.push(row.map_err(|e| format!("Failed to process row: {}", e))?);
    }
    
    Ok(TableInfo {
        columns,
        rows,
        success: true,
        total_count,
    })
}

#[command]
pub async fn update_table_row(
    state: State<'_, AppState>,
    table_name: String,
    row_data: HashMap<String, serde_json::Value>,
    condition: HashMap<String, serde_json::Value>,
) -> Result<DatabaseResult, String> {
    let db_connection = state.db_connection.lock().unwrap();
    let conn = db_connection
        .as_ref()
        .ok_or("No database connection available")?;
    
    // Build UPDATE query
    let set_clauses: Vec<String> = row_data
        .keys()
        .map(|col| format!("{} = ?", col))
        .collect();
    
    let where_clauses: Vec<String> = condition
        .keys()
        .map(|col| format!("{} = ?", col))
        .collect();
    
    let query = format!(
        "UPDATE {} SET {} WHERE {}",
        table_name,
        set_clauses.join(", "),
        where_clauses.join(" AND ")
    );
    
    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare update query: {}", e))?;
    
    // Bind parameters
    let mut params = Vec::new();
    for value in row_data.values() {
        params.push(json_value_to_rusqlite_value(value));
    }
    for value in condition.values() {
        params.push(json_value_to_rusqlite_value(value));
    }
    
    let rows_affected = stmt
        .execute(rusqlite::params_from_iter(params))
        .map_err(|e| format!("Failed to execute update: {}", e))?;
    
    Ok(DatabaseResult {
        success: true,
        message: Some(format!("Updated {} row(s)", rows_affected)),
        data: None,
    })
}

#[command]
pub async fn delete_table_row(
    state: State<'_, AppState>,
    table_name: String,
    condition: HashMap<String, serde_json::Value>,
) -> Result<DatabaseResult, String> {
    let db_connection = state.db_connection.lock().unwrap();
    let conn = db_connection
        .as_ref()
        .ok_or("No database connection available")?;
    
    let where_clauses: Vec<String> = condition
        .keys()
        .map(|col| format!("{} = ?", col))
        .collect();
    
    let query = format!("DELETE FROM {} WHERE {}", table_name, where_clauses.join(" AND "));
    
    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare delete query: {}", e))?;
    
    let params: Vec<_> = condition
        .values()
        .map(json_value_to_rusqlite_value)
        .collect();
    
    let rows_affected = stmt
        .execute(rusqlite::params_from_iter(params))
        .map_err(|e| format!("Failed to execute delete: {}", e))?;
    
    Ok(DatabaseResult {
        success: true,
        message: Some(format!("Deleted {} row(s)", rows_affected)),
        data: None,
    })
}

#[command]
pub async fn insert_table_row(
    state: State<'_, AppState>,
    table_name: String,
    row_data: HashMap<String, serde_json::Value>,
) -> Result<DatabaseResult, String> {
    let db_connection = state.db_connection.lock().unwrap();
    let conn = db_connection
        .as_ref()
        .ok_or("No database connection available")?;
    
    let columns: Vec<String> = row_data.keys().cloned().collect();
    let placeholders: Vec<String> = (0..columns.len()).map(|_| "?".to_string()).collect();
    
    let query = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        table_name,
        columns.join(", "),
        placeholders.join(", ")
    );
    
    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare insert query: {}", e))?;
    
    let params: Vec<_> = row_data
        .values()
        .map(json_value_to_rusqlite_value)
        .collect();
    
    let rows_affected = stmt
        .execute(rusqlite::params_from_iter(params))
        .map_err(|e| format!("Failed to execute insert: {}", e))?;
    
    Ok(DatabaseResult {
        success: true,
        message: Some(format!("Inserted {} row(s)", rows_affected)),
        data: None,
    })
}

#[command]
pub async fn execute_query(
    state: State<'_, AppState>,
    query: String,
) -> Result<DatabaseResult, String> {
    let db_connection = state.db_connection.lock().unwrap();
    let conn = db_connection
        .as_ref()
        .ok_or("No database connection available")?;
    
    // Determine if this is a SELECT query or not
    let trimmed_query = query.trim().to_uppercase();
    
    if trimmed_query.starts_with("SELECT") {
        // Handle SELECT queries
        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;
        
        let column_count = stmt.column_count();
        let column_names: Vec<String> = (0..column_count)
            .map(|i| stmt.column_name(i).unwrap_or("unknown").to_string())
            .collect();
        
        let mut rows = Vec::new();
        let query_rows = stmt
            .query_map([], |row| {
                let mut row_data = HashMap::new();
                for (i, column_name) in column_names.iter().enumerate() {
                    let value: serde_json::Value = match row.get_ref(i) {
                        Ok(value_ref) => match value_ref {
                            rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                            rusqlite::types::ValueRef::Integer(i) => serde_json::Value::Number(i.into()),
                            rusqlite::types::ValueRef::Real(f) => {
                                serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap_or_else(|| serde_json::Number::from(0)))
                            }
                            rusqlite::types::ValueRef::Text(s) => {
                                serde_json::Value::String(String::from_utf8_lossy(s).to_string())
                            }
                            rusqlite::types::ValueRef::Blob(b) => {
                                serde_json::Value::String(format!("BLOB({} bytes)", b.len()))
                            }
                        },
                        Err(_) => serde_json::Value::Null,
                    };
                    row_data.insert(column_name.clone(), value);
                }
                Ok(row_data)
            })
            .map_err(|e| format!("Failed to execute query: {}", e))?;
        
        for row in query_rows {
            rows.push(row.map_err(|e| format!("Failed to process row: {}", e))?);
        }
        
        Ok(DatabaseResult {
            success: true,
            message: Some(format!("Query executed successfully, {} rows returned", rows.len())),
            data: Some(serde_json::json!({
                "columns": column_names,
                "rows": rows
            })),
        })
    } else {
        // Handle non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
        let rows_affected = conn
            .execute(&query, [])
            .map_err(|e| format!("Failed to execute query: {}", e))?;
        
        Ok(DatabaseResult {
            success: true,
            message: Some(format!("Query executed successfully, {} rows affected", rows_affected)),
            data: None,
        })
    }
}

fn json_value_to_rusqlite_value(value: &serde_json::Value) -> rusqlite::types::Value {
    match value {
        serde_json::Value::Null => rusqlite::types::Value::Null,
        serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                rusqlite::types::Value::Null
            }
        }
        serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            rusqlite::types::Value::Text(value.to_string())
        }
    }
}
