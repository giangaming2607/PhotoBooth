import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const DB_PATH = path.join(process.cwd(), "database.json");
const SESSIONS_DIR = path.join(process.cwd(), "static", "sessions");

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Ensure database exists
const initialDB = {
  home_settings: {
    ui_theme: "default",
    btn_position: "center",
    logo_image: "",
    title_image: "",
    bg_type: "color",
    bg_color: "#1a1a2e",
    bg_image: "",
    title: "Welcome to Photobooth Pro",
    title_color: "#ffffff",
    btn_text: "Let's Go!",
    btn_bg_color: "#4f46e5",
    btn_text_color: "#ffffff",
    github_token: "",
    github_repo: "",
    netlify_url: "",
    countdown_time: 8,
    wa_message: "Here are your photobooth pictures! [LINK]",
    enable_remote_print: false
  },
  frames: [],
  sessions: []
};

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function writeDB(data: any) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Memory States
let printQueue: any[] = [];
const remoteCams = new Map<string, { frame: string, lastUpdated: number }>();

// Clean up dead remote cams
setInterval(() => {
  const now = Date.now();
  for (const [id, cam] of remoteCams.entries()) {
    if (now - cam.lastUpdated > 5000) {
      remoteCams.delete(id);
    }
  }
}, 5000);

// Background threaded task for GitHub + Netlify mockup
async function processCloudUpload(sessionId: string, pngData: string, gifData: string) {
  const db = readDB();
  const settings = db.home_settings;
  if (!settings.github_token || !settings.github_repo) return;
  // This is a placeholder for actual GitHub REST API uploads
  // In a real scenario, we'd use axios to upload the blobs to github
  console.log(`[Cloud Task] Uploading session ${sessionId} to GitHub...`);
}

// ---- API ENDPOINTS ----

// 1. Sistem Antrian Operator
app.post("/api/print_queue", (req, res) => {
  const { session_id, image_url } = req.body;
  const job = { id: uuidv4(), session_id, image_url, status: "pending", timestamp: Date.now() };
  printQueue.push(job);
  res.json({ success: true, job });
});

app.get("/api/print_queue", (req, res) => {
  const pending = printQueue.filter(q => q.status === "pending");
  res.json({ success: true, pending, total_queue: pending.length });
});

app.put("/api/print_queue/:job_id", (req, res) => {
  const job = printQueue.find(q => q.id === req.params.job_id);
  if (job) {
    job.status = "completed";
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: "Job not found" });
  }
});

// 2. Transmisi Kamera HP Nirkabel
app.post("/api/remote_camera", (req, res) => {
  const { frame, deviceId = "default" } = req.body;
  remoteCams.set(deviceId, { frame, lastUpdated: Date.now() });
  res.json({ success: true });
});

app.get("/api/remote_camera", (req, res) => {
  const deviceId = req.query.deviceId as string || "default";
  const cam = remoteCams.get(deviceId);
  if (cam && (Date.now() - cam.lastUpdated <= 5000)) {
    res.json({ success: true, frame: cam.frame });
  } else {
    res.status(404).json({ success: false, error: "Camera disconnected or timeout" });
  }
});

// 3. Autentikasi
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin") {
    res.json({ success: true, role: "admin" });
  } else if (username === "photo" && password === "photo") {
    res.json({ success: true, role: "photo" });
  } else {
    res.status(401).json({ success: false, error: "Invalid credentials" });
  }
});

// 4. Manajemen Konfigurasi
app.get("/api/config", (req, res) => {
  const db = readDB();
  res.json({ success: true, config: db.home_settings });
});

app.post("/api/config/home", (req, res) => {
  const db = readDB();
  db.home_settings = { ...db.home_settings, ...req.body };
  writeDB(db);
  res.json({ success: true });
});

app.post("/api/database/import", (req, res) => {
  if (req.body && req.body.home_settings && req.body.frames) {
    writeDB(req.body);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: "Invalid schema" });
  }
});

app.get("/api/database/export", (req, res) => {
  res.json(readDB());
});

// 5. CRUD Frames
app.get("/api/frames", (req, res) => {
  const db = readDB();
  res.json({ success: true, frames: db.frames });
});

app.post("/api/frames", (req, res) => {
  const db = readDB();
  const idx = db.frames.findIndex((f: any) => f.id === req.body.id);
  if (idx > -1) {
    db.frames[idx] = req.body;
  } else {
    db.frames.push({ id: uuidv4(), ...req.body });
  }
  writeDB(db);
  res.json({ success: true });
});

app.delete("/api/frames/:id", (req, res) => {
  const db = readDB();
  db.frames = db.frames.filter((f: any) => f.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.get("/api/sessions", (req, res) => {
  const db = readDB();
  res.json({ success: true, sessions: db.sessions });
});

// 6. Proses Upload & Background Task
app.post("/api/upload", (req, res) => {
  const { png_b64, gif_b64 } = req.body;
  const sessionId = uuidv4();
  
  // Save local files
  const pngPath = path.join(SESSIONS_DIR, `${sessionId}.png`);
  let localPngUrl = `/static/sessions/${sessionId}.png`;
  let localGifUrl = "";

  if (png_b64) {
    const b64Data = png_b64.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(pngPath, b64Data, 'base64');
  }

  if (gif_b64) {
    const gifPath = path.join(SESSIONS_DIR, `${sessionId}.gif`);
    const b64Data = gif_b64.replace(/^data:image\/gif;base64,/, "");
    fs.writeFileSync(gifPath, b64Data, 'base64');
    localGifUrl = `/static/sessions/${sessionId}.gif`;
  }

  const db = readDB();
  const sessionData = {
    id: sessionId,
    png_url: localPngUrl,
    gif_url: localGifUrl,
    timestamp: Date.now(),
    cloud_url: db.home_settings.netlify_url ? `${db.home_settings.netlify_url}/${sessionId}.html` : ""
  };

  db.sessions.unshift(sessionData); // Add to beginning
  if (db.sessions.length > 15) {
    db.sessions = db.sessions.slice(0, 15);
  }
  writeDB(db);

  // Background thread
  setTimeout(() => processCloudUpload(sessionId, png_b64, gif_b64), 0);

  // Provide target URL for QR
  const hostUrl = req.headers.host;
  const protocol = "https"; // always assume https behind proxy in AI studio
  const shareLink = `${protocol}://${hostUrl}/share/${sessionId}`;
  
  res.json({ 
    success: true, 
    session_id: sessionId, 
    local_url: localPngUrl,
    share_link: shareLink,
    qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareLink)}`
  });
});

app.post("/api/upload_gif/:id", (req, res) => {
  const { gif_b64 } = req.body;
  const sessionId = req.params.id;
  if (!gif_b64) return res.json({success: false});
  
  const gifPath = path.join(SESSIONS_DIR, `${sessionId}.gif`);
  const b64Data = gif_b64.replace(/^data:image\/gif;base64,/, "");
  fs.writeFileSync(gifPath, b64Data, 'base64');
  const localGifUrl = `/static/sessions/${sessionId}.gif`;
  
  const db = readDB();
  const session = db.sessions.find((s:any) => s.id === sessionId);
  if (session) {
    session.gif_url = localGifUrl;
    writeDB(db);
  }
  res.json({ success: true, gif_url: localGifUrl });
});

// Serve static assets
app.use("/static", express.static(path.join(process.cwd(), "static")));

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
