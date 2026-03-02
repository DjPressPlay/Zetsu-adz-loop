import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.CRYPTO_KEY || 'zetsu-ads-loop-fallback-key-32-chars'; // Must be 32 chars
const IV_LENGTH = 16;

function encrypt(text: string) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return "[DECRYPTION_FAILED]";
  }
}

// Autonomous Engine Logic (Extracted for Serverless/Cron compatibility)
async function runAutonomousCycle() {
  const { data: pipelines, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('status', 'ACTIVE');

  if (error || !pipelines) {
    console.error('[ADBOT] Error fetching pipelines:', error);
    return;
  }

  for (const p of pipelines) {
    const lastRun = p.last_run ? new Date(p.last_run).getTime() : 0;
    const now = Date.now();
    
    // Check if it's been at least 1 hour since the last run
    if (now - lastRun > 3600000) {
      const decryptedToken = decrypt(p.access_token);
      console.log(`[ADBOT] Executing autonomous cycle for: ${p.url} using token: ${decryptedToken?.substring(0, 8)}...`);
      
      // In a real app, we would call Gemini here and then the Social API
      // For this tool, we'll trigger the activity log which represents the "Post"
      
      // Update last_run and posts_completed
      await supabase
        .from('pipelines')
        .update({ 
          posts_completed: (p.posts_completed || 0) + 1,
          last_run: new Date().toISOString()
        })
        .eq('id', p.id);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Pipeline Management
  app.get("/api/pipelines", async (req, res) => {
    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Mask tokens for the UI
    const maskedPipelines = data.map(p => ({
      ...p,
      access_token: p.access_token ? "••••••••••••••••" : null
    }));
    res.json(maskedPipelines);
  });

  app.post("/api/pipelines", async (req, res) => {
    const { name, url, social_handle, platform, target_posts, access_token, posts_per_day } = req.body;
    const encryptedToken = encrypt(access_token);
    
    const { data, error } = await supabase
      .from('pipelines')
      .insert([{
        name,
        url,
        social_handle,
        platform,
        target_posts,
        access_token: encryptedToken,
        posts_per_day: posts_per_day || 3
      }])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data[0].id });
  });

  app.patch("/api/pipelines/:id", async (req, res) => {
    const { posts_per_day } = req.body;
    const { error } = await supabase
      .from('pipelines')
      .update({ posts_per_day })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete("/api/pipelines/:id", async (req, res) => {
    // Delete activity logs first
    await supabase.from('activity_log').delete().eq('pipeline_id', req.params.id);
    // Delete pipeline
    const { error } = await supabase.from('pipelines').delete().eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Activity Logs
  app.get("/api/activity", async (req, res) => {
    const { data, error } = await supabase
      .from('activity_log')
      .select(`
        *,
        pipelines (
          name,
          platform
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    
    // Flatten the result to match the previous structure
    const flattenedLogs = data.map(l => ({
      ...l,
      pipeline_name: l.pipelines?.name,
      platform: l.pipelines?.platform
    }));
    
    res.json(flattenedLogs);
  });

  app.post("/api/activity", async (req, res) => {
    const { pipeline_id, type, message, metadata } = req.body;
    
    const { error } = await supabase
      .from('activity_log')
      .insert([{ pipeline_id, type, message, metadata }]);

    if (error) return res.status(500).json({ error: error.message });
    
    if (type === 'POSTING') {
      // Update pipeline stats
      const { data: pipeline } = await supabase.from('pipelines').select('posts_completed').eq('id', pipeline_id).single();
      await supabase
        .from('pipelines')
        .update({ 
          posts_completed: (pipeline?.posts_completed || 0) + 1,
          last_run: new Date().toISOString()
        })
        .eq('id', pipeline_id);
    }
    res.json({ success: true });
  });

  // Keep the interval for local development, but it's ready for Netlify Scheduled Functions
  setInterval(runAutonomousCycle, 30000);

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
