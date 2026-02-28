import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("adbot.db");

// Initialize database with pipelines and logs
db.exec(`
  CREATE TABLE IF NOT EXISTS pipelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    url TEXT,
    social_handle TEXT,
    platform TEXT,
    access_token TEXT,
    target_posts INTEGER,
    posts_completed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_run DATETIME
  );
`);

// Migration: Add access_token if missing
try {
  db.prepare("ALTER TABLE pipelines ADD COLUMN access_token TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE pipelines ADD COLUMN posts_per_day INTEGER DEFAULT 3").run();
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline_id INTEGER,
    type TEXT, -- 'GENERATION', 'POSTING', 'ANALYSIS'
    message TEXT,
    metadata TEXT, -- JSON string for ad content
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(pipeline_id) REFERENCES pipelines(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Pipeline Management
  app.get("/api/pipelines", (req, res) => {
    const pipelines = db.prepare("SELECT * FROM pipelines ORDER BY created_at DESC").all();
    res.json(pipelines);
  });

  app.post("/api/pipelines", (req, res) => {
    const { name, url, social_handle, platform, target_posts, access_token, posts_per_day } = req.body;
    const info = db.prepare(
      "INSERT INTO pipelines (name, url, social_handle, platform, target_posts, access_token, posts_per_day) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(name, url, social_handle, platform, target_posts, access_token, posts_per_day || 3);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/pipelines/:id", (req, res) => {
    const { posts_per_day } = req.body;
    db.prepare("UPDATE pipelines SET posts_per_day = ? WHERE id = ?").run(posts_per_day, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/pipelines/:id", (req, res) => {
    db.prepare("DELETE FROM pipelines WHERE id = ?").run(req.params.id);
    db.prepare("DELETE FROM activity_log WHERE pipeline_id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Activity Logs
  app.get("/api/activity", (req, res) => {
    const logs = db.prepare(`
      SELECT l.*, p.name as pipeline_name, p.platform 
      FROM activity_log l 
      JOIN pipelines p ON l.pipeline_id = p.id 
      ORDER BY l.created_at DESC 
      LIMIT 50
    `).all();
    res.json(logs);
  });

  app.post("/api/activity", (req, res) => {
    const { pipeline_id, type, message, metadata } = req.body;
    db.prepare(
      "INSERT INTO activity_log (pipeline_id, type, message, metadata) VALUES (?, ?, ?, ?)"
    ).run(pipeline_id, type, message, metadata);
    
    if (type === 'POSTING') {
      db.prepare("UPDATE pipelines SET posts_completed = posts_completed + 1, last_run = CURRENT_TIMESTAMP WHERE id = ?")
        .run(pipeline_id);
    }
    res.json({ success: true });
  });

  // Autonomous Engine (Server-Side)
  // This runs every 30 seconds to check if any pipeline needs a new post
  setInterval(async () => {
    const pipelines = db.prepare("SELECT * FROM pipelines WHERE status = 'ACTIVE'").all();
    
    for (const p of pipelines) {
      // Check if it's been at least 1 hour since the last run (or if it's never run)
      const lastRun = p.last_run ? new Date(p.last_run).getTime() : 0;
      const now = Date.now();
      
      if (now - lastRun > 3600000) { // 1 hour interval
        console.log(`[ADBOT] Executing autonomous cycle for: ${p.url} using token: ${p.access_token?.substring(0, 8)}...`);
        
        // In a real app, we would call Gemini here and then the Social API
        // For this tool, we'll trigger the activity log which represents the "Post"
        // The frontend will see this update via the polling fetchData
      }
    }
  }, 30000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
