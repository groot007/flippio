#!/usr/bin/env node

/**
 * Generate Test Databases for Flippio Testing
 * 
 * This script creates SQLite databases with realistic test data
 * for testing the complete user workflow.
 */

const { Buffer } = require('node:buffer')
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')
const Database = require('better-sqlite3')

// Database directory paths
const TEST_DB_DIR = path.join(__dirname, '../src-tauri/tests/fixtures/databases')
const EXAMPLE_DB_DIR = path.join(__dirname, '../example_app/databases')

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`📁 Created directory: ${dirPath}`)
  }
}

function createEcommerceDatabase(dbPath) {
  console.log('🛍️  Creating e-commerce test database...')
    
  const db = new Database(dbPath)
    
  // Create schema
  db.exec(`
        -- Users table
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        );
        
        -- Categories table
        CREATE TABLE categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Products table
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            category_id INTEGER,
            stock_quantity INTEGER DEFAULT 0,
            description TEXT,
            sku TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        );
        
        -- Orders table
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL,
            status TEXT CHECK(status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
            shipping_address TEXT,
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            shipped_date DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        -- Order Items table
        CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
        
        -- User sessions table (for testing different data types)
        CREATE TABLE user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_agent TEXT,
            ip_address TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `)
    
  // Insert test data
  console.log('📊 Inserting test data...')
    
  // Categories
  const insertCategory = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)')
  const categories = [
    ['Electronics', 'Electronic devices and accessories'],
    ['Clothing', 'Apparel and fashion items'],
    ['Books', 'Physical and digital books'],
    ['Home & Garden', 'Home improvement and gardening supplies'],
  ]
    
  for (const category of categories) {
    insertCategory.run(category)
  }
    
  // Users
  const insertUser = db.prepare('INSERT INTO users (username, email, first_name, last_name, is_active) VALUES (?, ?, ?, ?, ?)')
  const users = [
    ['john_doe', 'john.doe@example.com', 'John', 'Doe', 1],
    ['jane_smith', 'jane.smith@example.com', 'Jane', 'Smith', 1],
    ['mike_jones', 'mike.jones@example.com', 'Mike', 'Jones', 1],
    ['sarah_wilson', 'sarah.wilson@example.com', 'Sarah', 'Wilson', 0],
    ['test_user', 'test@example.com', 'Test', 'User', 1],
  ]
    
  for (const user of users) {
    insertUser.run(user)
  }
    
  // Products
  const insertProduct = db.prepare('INSERT INTO products (name, price, category_id, stock_quantity, description, sku) VALUES (?, ?, ?, ?, ?, ?)')
  const products = [
    ['MacBook Pro 16"', 2499.99, 1, 15, 'Professional laptop with M3 Pro chip', 'MBP-16-M3PRO'],
    ['iPhone 15 Pro', 999.99, 1, 50, 'Latest iPhone with titanium design', 'IPH-15-PRO'],
    ['AirPods Pro 2', 249.99, 1, 75, 'Wireless earbuds with active noise cancellation', 'APP-2-GEN'],
    ['Organic Cotton T-Shirt', 29.99, 2, 100, 'Comfortable organic cotton t-shirt', 'OCT-SHIRT-001'],
    ['JavaScript: The Good Parts', 34.99, 3, 25, 'Classic programming book', 'JS-GOOD-PARTS'],
    ['Smart Home Hub', 149.99, 4, 30, 'Central control for smart home devices', 'SH-HUB-001'],
  ]
    
  for (const product of products) {
    insertProduct.run(product)
  }
    
  // Orders
  const insertOrder = db.prepare('INSERT INTO orders (user_id, total_amount, status, shipping_address, order_date) VALUES (?, ?, ?, ?, ?)')
  const orders = [
    [1, 2499.99, 'delivered', '123 Main St, Anytown, USA 12345', '2024-01-15 10:30:00'],
    [2, 1249.98, 'shipped', '456 Oak Ave, Another City, USA 67890', '2024-01-20 14:15:00'],
    [3, 279.98, 'processing', '789 Pine Rd, Somewhere, USA 11111', '2024-01-25 09:45:00'],
    [1, 34.99, 'pending', '123 Main St, Anytown, USA 12345', '2024-01-26 16:20:00'],
  ]
    
  for (const order of orders) {
    insertOrder.run(order)
  }
    
  // Order Items
  const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)')
  const orderItems = [
    [1, 1, 1, 2499.99, 2499.99], // MacBook Pro
    [2, 2, 1, 999.99, 999.99], // iPhone 15 Pro
    [2, 3, 1, 249.99, 249.99], // AirPods Pro
    [3, 4, 2, 29.99, 59.98], // 2x T-Shirts
    [3, 6, 1, 149.99, 149.99], // Smart Home Hub
    [3, 5, 2, 34.99, 69.98], // 2x Books
    [4, 5, 1, 34.99, 34.99], // JavaScript book
  ]
    
  for (const item of orderItems) {
    insertOrderItem.run(item)
  }
    
  // User Sessions (for testing different data types)
  const insertSession = db.prepare('INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)')
  const sessions = [
    [1, 'sess_abc123def456', '2024-02-01 10:30:00', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '192.168.1.100'],
    [2, 'sess_xyz789uvw012', '2024-02-01 14:15:00', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '192.168.1.101'],
    [3, 'sess_mno345pqr678', '2024-02-01 09:45:00', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', '192.168.1.102'],
  ]
    
  for (const session of sessions) {
    insertSession.run(session)
  }
    
  db.close()
  console.log('✅ E-commerce database created successfully')
}

function createNotesDatabase(dbPath) {
  console.log('📝 Creating notes test database...')
    
  const db = new Database(dbPath)
    
  // Create schema
  db.exec(`
        -- Notes table
        CREATE TABLE notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            category TEXT DEFAULT 'general',
            tags TEXT, -- JSON array stored as text
            is_favorite BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Note attachments table
        CREATE TABLE note_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER,
            mime_type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (note_id) REFERENCES notes(id)
        );
    `)
    
  // Insert test data
  const insertNote = db.prepare('INSERT INTO notes (title, content, category, tags, is_favorite) VALUES (?, ?, ?, ?, ?)')
  const notes = [
    ['Meeting Notes - Q1 Planning', 'Discussed project roadmap for Q1 2024. Key priorities: user experience improvements, performance optimization, and new feature development.', 'work', '["meeting", "planning", "q1"]', 1],
    ['Shopping List', 'Groceries needed:\n- Milk (organic)\n- Bread (whole grain)\n- Eggs (free range)\n- Apples\n- Chicken breast', 'personal', '["shopping", "groceries"]', 0],
    ['App Ideas', 'Ideas for new mobile apps:\n1. Expense tracker with AI categorization\n2. Plant care reminder app\n3. Local event discovery platform', 'ideas', '["apps", "development", "mobile"]', 1],
    ['Book Recommendations', 'Books to read:\n- "Clean Code" by Robert Martin\n- "The Pragmatic Programmer" by Hunt & Thomas\n- "System Design Interview" by Alex Xu', 'learning', '["books", "programming", "development"]', 0],
    ['Travel Plans', 'Summer vacation ideas:\n- Japan (Tokyo, Kyoto)\n- Iceland (Reykjavik, Blue Lagoon)\n- New Zealand (Auckland, Queenstown)', 'personal', '["travel", "vacation", "summer"]', 1],
  ]
    
  for (const note of notes) {
    insertNote.run(note)
  }
    
  // Insert attachments
  const insertAttachment = db.prepare('INSERT INTO note_attachments (note_id, filename, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?)')
  const attachments = [
    [1, 'meeting_agenda.pdf', '/documents/meeting_agenda.pdf', 245760, 'application/pdf'],
    [3, 'app_wireframes.png', '/images/app_wireframes.png', 1048576, 'image/png'],
    [4, 'reading_list.txt', '/documents/reading_list.txt', 2048, 'text/plain'],
  ]
    
  for (const attachment of attachments) {
    insertAttachment.run(attachment)
  }
    
  db.close()
  console.log('✅ Notes database created successfully')
}

function createComplexTypesDatabase(dbPath) {
  console.log('🔧 Creating complex types test database...')
    
  const db = new Database(dbPath)
    
  // Create schema with various data types and edge cases
  db.exec(`
        -- Mixed data types table
        CREATE TABLE mixed_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text_field TEXT,
            integer_field INTEGER,
            real_field REAL,
            blob_field BLOB,
            null_field TEXT,
            json_field TEXT, -- JSON data stored as text
            large_text TEXT,
            boolean_field BOOLEAN,
            timestamp_field DATETIME,
            decimal_field DECIMAL(10,2)
        );
        
        -- Edge cases table
        CREATE TABLE edge_cases (
            id INTEGER PRIMARY KEY,
            empty_string TEXT,
            whitespace_string TEXT,
            unicode_text TEXT,
            special_chars TEXT,
            very_long_text TEXT,
            negative_number INTEGER,
            zero_value INTEGER,
            max_integer INTEGER
        );
    `)
    
  // Insert test data with various types
  const insertMixed = db.prepare(`
        INSERT INTO mixed_types (
            text_field, integer_field, real_field, blob_field, null_field, 
            json_field, large_text, boolean_field, timestamp_field, decimal_field
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
  const mixedData = [
    [
      'Sample Text',
      42,
      3.14159,
      Buffer.from('Hello World', 'utf8'),
      null,
      '{"name": "John", "age": 30, "skills": ["JavaScript", "Python", "Rust"]}',
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50),
      1, // true as integer
      '2024-01-27 12:00:00',
      999.99,
    ],
    [
      'Another Sample',
      -17,
      2.71828,
      Buffer.from('Binary Data', 'utf8'),
      null,
      '{"settings": {"theme": "dark", "notifications": true}, "preferences": [1, 2, 3]}',
      'Short text',
      0, // false as integer
      '2024-01-26 08:30:00',
      -123.45,
    ],
  ]
    
  for (const data of mixedData) {
    insertMixed.run(data)
  }
    
  // Insert edge cases
  const insertEdge = db.prepare(`
        INSERT INTO edge_cases (
            id, empty_string, whitespace_string, unicode_text, special_chars,
            very_long_text, negative_number, zero_value, max_integer
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
  const edgeData = [
    [
      1,
      '', // empty string
      '   \t\n   ', // whitespace
      'Unicode: 🚀 ñáéíóú 中文 日本語 🎉', // unicode
      `Special chars: !@#$%^&*()_+-=[]{}|;':",./<>?`, // special characters
      `Very long text: ${'A'.repeat(1000)}`, // long text
      -9999999,
      0,
      2147483647, // max 32-bit integer
    ],
  ]
    
  for (const data of edgeData) {
    insertEdge.run(data)
  }
    
  db.close()
  console.log('✅ Complex types database created successfully')
}

function createTestDatabases() {
  console.log('🎯 Starting test database generation...\n')
    
  // Ensure directories exist
  ensureDirectoryExists(TEST_DB_DIR)
  ensureDirectoryExists(EXAMPLE_DB_DIR)
    
  try {
    // Remove existing databases if they exist
    const testDbs = [
      path.join(TEST_DB_DIR, 'test_ecommerce.db'),
      path.join(TEST_DB_DIR, 'test_notes.db'),
      path.join(TEST_DB_DIR, 'test_complex.db'),
      path.join(EXAMPLE_DB_DIR, 'ecommerce_sample.db'),
      path.join(EXAMPLE_DB_DIR, 'notes_sample.db'),
    ]
        
    for (const dbPath of testDbs) {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath)
        console.log(`🗑️  Removed existing: ${path.basename(dbPath)}`)
      }
    }
        
    // Create test databases
    createEcommerceDatabase(path.join(TEST_DB_DIR, 'test_ecommerce.db'))
    createNotesDatabase(path.join(TEST_DB_DIR, 'test_notes.db'))
    createComplexTypesDatabase(path.join(TEST_DB_DIR, 'test_complex.db'))
        
    // Also create copies in example app directory for development
    createEcommerceDatabase(path.join(EXAMPLE_DB_DIR, 'ecommerce_sample.db'))
    createNotesDatabase(path.join(EXAMPLE_DB_DIR, 'notes_sample.db'))
        
    console.log('\n🎉 All test databases created successfully!')
    console.log(`📁 Test databases location: ${TEST_DB_DIR}`)
    console.log(`📁 Example databases location: ${EXAMPLE_DB_DIR}`)
        
    // List created files
    console.log('\n📋 Created files:')
    const testFiles = fs.readdirSync(TEST_DB_DIR)
    testFiles.forEach((file) => {
      if (file.endsWith('.db')) {
        const filePath = path.join(TEST_DB_DIR, file)
        const stats = fs.statSync(filePath)
        console.log(`  ✓ ${file} (${Math.round(stats.size / 1024)}KB)`)
      }
    })
  }
  catch (error) {
    console.error('❌ Error creating test databases:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  // Check if better-sqlite3 is available
  try {
    require('better-sqlite3')
  }
  catch {
    console.error('❌ better-sqlite3 is required but not installed.')
    console.log('📦 Install it with: npm install --save-dev better-sqlite3')
    process.exit(1)
  }
    
  createTestDatabases()
}

module.exports = { createTestDatabases } 
