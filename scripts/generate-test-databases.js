#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose()
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

// Create test databases directory
const testDbDir = path.join(__dirname, '..', 'src-tauri', 'tests', 'fixtures', 'databases')
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true })
}

// Database configurations
const databases = [
  {
    name: 'test_ecommerce.db',
    description: 'E-commerce App (Complex schema with foreign keys)',
    tables: ['users', 'products', 'orders', 'payments'],
  },
  {
    name: 'test_social.db', 
    description: 'Social Media App (Medium complexity)',
    tables: ['profiles', 'posts', 'comments', 'likes'],
  },
  {
    name: 'test_notes.db',
    description: 'Note-taking App (Simple schema)',
    tables: ['folders', 'notes', 'tags', 'note_tags'],
  },
]

// SQL for each database
const ecommerceSql = `
-- E-commerce Database Schema
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_premium INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT DEFAULT 'general',
    stock_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'card',
    transaction_id TEXT UNIQUE,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

INSERT INTO users (username, email, is_premium) VALUES 
    ('john_doe', 'john@example.com', 1),
    ('jane_smith', 'jane@example.com', 0),
    ('bob_wilson', 'bob@example.com', 1);

INSERT INTO products (name, price, category, stock_count) VALUES 
    ('iPhone 15', 999.99, 'electronics', 50),
    ('MacBook Pro', 1999.99, 'electronics', 25),
    ('Coffee Mug', 12.99, 'home', 100),
    ('Bluetooth Headphones', 199.99, 'electronics', 75);

INSERT INTO orders (user_id, product_id, quantity, total_amount, status) VALUES 
    (1, 1, 1, 999.99, 'completed'),
    (2, 3, 2, 25.98, 'pending'),
    (3, 2, 1, 1999.99, 'shipped');

INSERT INTO payments (order_id, amount, payment_method, transaction_id) VALUES 
    (1, 999.99, 'card', 'txn_001'),
    (3, 1999.99, 'paypal', 'txn_002');
`

const socialSql = `
-- Social Media Database Schema
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle TEXT NOT NULL UNIQUE,
    display_name TEXT,
    bio TEXT,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    profile_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    profile_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, profile_id),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

INSERT INTO profiles (handle, display_name, bio, follower_count, following_count) VALUES 
    ('@tech_guru', 'Tech Guru', 'Love coding and coffee ☕', 1250, 340),
    ('@photo_lover', 'Sarah Photography', 'Capturing moments 📸', 890, 567),
    ('@foodie_mike', 'Mike Food Reviews', 'Eating my way around the world 🌮', 2100, 123);

INSERT INTO posts (profile_id, content, like_count, comment_count) VALUES 
    (1, 'Just shipped a new feature! 🚀 #coding #tech', 45, 12),
    (2, 'Golden hour shots from today''s photoshoot ✨', 78, 23),
    (3, 'Best tacos in town! Who wants the recipe? 🌮', 156, 34);

INSERT INTO comments (post_id, profile_id, content) VALUES 
    (1, 2, 'Awesome work! What tech stack did you use?'),
    (1, 3, 'Congrats on the launch! 🎉'),
    (2, 1, 'Beautiful lighting! 💯'),
    (3, 2, 'I need that recipe ASAP! 😍');

INSERT INTO likes (post_id, profile_id) VALUES 
    (1, 2), (1, 3),
    (2, 1), (2, 3),
    (3, 1), (3, 2);
`

const notesSql = `
-- Notes Database Schema
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#007AFF',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER,
    title TEXT NOT NULL,
    content TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#FF9500'
);

CREATE TABLE IF NOT EXISTS note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

INSERT INTO folders (name, color) VALUES 
    ('Work', '#FF3B30'),
    ('Personal', '#34C759'),
    ('Ideas', '#AF52DE');

INSERT INTO notes (folder_id, title, content, is_favorite) VALUES 
    (1, 'Meeting Notes', 'Discussed Q4 planning and budget allocation...', 1),
    (1, 'Project Roadmap', 'Feature releases planned for next quarter...', 0),
    (2, 'Grocery List', 'Milk, eggs, bread, coffee beans...', 0),
    (3, 'App Idea', 'A productivity app that combines notes with calendar...', 1);

INSERT INTO tags (name, color) VALUES 
    ('urgent', '#FF3B30'),
    ('work', '#007AFF'),
    ('personal', '#34C759'),
    ('idea', '#FF9500');

INSERT INTO note_tags (note_id, tag_id) VALUES 
    (1, 1), (1, 2),
    (2, 2),
    (3, 3),
    (4, 4);
`

const sqlScripts = [ecommerceSql, socialSql, notesSql]

async function createDatabase(dbPath, sql, dbInfo) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(new Error(`Error creating database ${dbInfo.name}: ${err.message}`))
        return
      }
      console.log(`📁 Creating database: ${dbInfo.name}`)
      console.log(`   Description: ${dbInfo.description}`)
      console.log(`   Tables: ${dbInfo.tables.join(', ')}`)
    })

    db.exec(sql, (err) => {
      if (err) {
        reject(new Error(`Error executing SQL for ${dbInfo.name}: ${err.message}`))
        return
      }

      db.close((err) => {
        if (err) {
          reject(new Error(`Error closing database ${dbInfo.name}: ${err.message}`))
          return
        }
        console.log(`✅ Successfully created: ${dbInfo.name}`)
        resolve()
      })
    })
  })
}

async function generateTestDatabases() {
  console.log('🚀 Generating test databases for Flippio...\n')

  try {
    for (let i = 0; i < databases.length; i++) {
      const dbInfo = databases[i]
      const dbPath = path.join(testDbDir, dbInfo.name)
            
      // Remove existing database
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath)
        console.log(`🗑️  Removed existing: ${dbInfo.name}`)
      }

      await createDatabase(dbPath, sqlScripts[i], dbInfo)
    }

    console.log('\n🎉 All test databases created successfully!')
    console.log(`📍 Location: ${testDbDir}`)
    console.log('\nDatabases created:')
    databases.forEach((db) => {
      console.log(`   • ${db.name} - ${db.description}`)
    })

    // Verify databases
    console.log('\n🔍 Verifying databases...')
    for (const dbInfo of databases) {
      const dbPath = path.join(testDbDir, dbInfo.name)
      const stats = fs.statSync(dbPath)
      console.log(`   ✅ ${dbInfo.name}: ${(stats.size / 1024).toFixed(1)} KB`)
    }
  }
  catch (error) {
    console.error('❌ Error generating test databases:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  generateTestDatabases()
}

module.exports = { generateTestDatabases, databases } 
