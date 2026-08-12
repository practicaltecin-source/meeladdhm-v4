import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));

  const DB_FILE_PATH = path.join(process.cwd(), "db.json");

  // Load initial DB from db.json if present
  let dbInMemory: any = null;
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, "utf8");
      dbInMemory = JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load db.json, using fallback", err);
  }

  const DEFAULT_SERVER_DB = {
    teams: [],
    programs: [],
    participants: [],
    results: [],
    settings: {
      points: {
        first: 10,
        second: 7,
        third: 5,
        participation: 1,
        gradeA: 5,
        gradeB: 3,
        gradeC: 1
      },
      adminPassword: 'admin123',
      adminPin: '1234',
      eventName: 'Meeladunnabi Celebrations',
      boardName: 'Islamic Academic Board',
      subtitle: 'Live Competition Results, Scoring Points & Schedules',
      showFinalWinner: false,
      showScoreboard: true,
      showDetailedScoreboard: true
    },
    prevRanks: {},
    lastModified: Date.now()
  };

  // Only initialize dbInMemory if empty or missing required array fields
  if (!dbInMemory || !Array.isArray(dbInMemory.teams)) {
    dbInMemory = DEFAULT_SERVER_DB;
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(DEFAULT_SERVER_DB, null, 2), "utf8");
      console.log("Initialized fresh db.json on server start");
    } catch (err) {
      console.error("Could not write default db.json", err);
    }
  } else {
    console.log("Loaded existing database from db.json successfully");
  }

  const HARDCODED_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxao2v_cKiIznKc98Td20VsOKe1-niZmF9pk1qo1s3suIUTy4AcUNyFCI485XXKGR3r/exec";

  // Helper to fetch remote database from Google Apps Script Web App
  async function fetchFromAppsScript(): Promise<any | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(HARDCODED_APPS_SCRIPT_URL, {
        method: "GET",
        headers: { "Accept": "application/json, text/plain, */*" },
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const text = await response.text();
        if (text && !text.includes("Script function not found")) {
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === "object") {
              const dbObj = parsed.db || parsed.data || parsed.result || parsed;
              if (dbObj && Array.isArray(dbObj.teams)) {
                return dbObj;
              }
            }
          } catch (e) {}
        }
      }

      // Secondary attempt: POST with { action: 'read' }
      const postController = new AbortController();
      const postTimeout = setTimeout(() => postController.abort(), 3500);

      const postResponse = await fetch(HARDCODED_APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "read" }),
        redirect: "follow",
        signal: postController.signal
      });
      clearTimeout(postTimeout);

      if (postResponse.ok) {
        const postText = await postResponse.text();
        if (postText && !postText.includes("Script function not found")) {
          try {
            const parsed = JSON.parse(postText);
            if (parsed && typeof parsed === "object") {
              const dbObj = parsed.db || parsed.data || parsed.result || parsed;
              if (dbObj && Array.isArray(dbObj.teams)) {
                return dbObj;
              }
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      // Gracefully fall back to local dbInMemory
    }
    return null;
  }

  // Helper to push database updates to Google Apps Script Web App
  async function pushToAppsScript(dbData: any): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        action: "write",
        db: dbData,
        lastModified: dbData.lastModified || Date.now()
      });

      const targets = [HARDCODED_APPS_SCRIPT_URL];
      if (dbData?.settings?.sheetWebhookUrl && dbData.settings.sheetWebhookUrl !== HARDCODED_APPS_SCRIPT_URL) {
        targets.push(dbData.settings.sheetWebhookUrl);
      }
      if (dbData?.settings?.appsScriptUrl && dbData.settings.appsScriptUrl !== HARDCODED_APPS_SCRIPT_URL && !targets.includes(dbData.settings.appsScriptUrl)) {
        targets.push(dbData.settings.appsScriptUrl);
      }

      for (const targetUrl of targets) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);

          fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: payload,
            redirect: "follow",
            signal: controller.signal
          }).catch(() => {});

          clearTimeout(timeout);
        } catch (e) {}
      }

      return true;
    } catch (err) {
      return false;
    }
  }

  // API routes FIRST
  app.post("/api/webhook-proxy", async (req, res) => {
    try {
      const { url, payload, db } = req.body || {};
      const customUrl = url || db?.settings?.sheetWebhookUrl || db?.settings?.appsScriptUrl || dbInMemory?.settings?.sheetWebhookUrl || dbInMemory?.settings?.appsScriptUrl;
      const targetUrl = customUrl || HARDCODED_APPS_SCRIPT_URL;

      const syncData = payload || {
        action: "write",
        db: db || dbInMemory,
        lastModified: Date.now()
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(syncData),
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeout);

      const responseText = await response.text();
      return res.json({
        success: response.ok,
        status: response.status,
        message: responseText ? responseText.slice(0, 500) : "Successfully triggered sync to Google Sheet Webhook"
      });
    } catch (err: any) {
      console.error("Webhook proxy execution error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to reach Google Sheet Webhook server"
      });
    }
  });
  app.get("/api/db", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Return in-memory database immediately for lightning-fast responses
    res.json(dbInMemory || DEFAULT_SERVER_DB);

    // Optionally check remote in background without delaying response
    const customUrl = dbInMemory?.settings?.sheetWebhookUrl || dbInMemory?.settings?.appsScriptUrl;
    if (customUrl && customUrl !== HARDCODED_APPS_SCRIPT_URL) {
      fetchFromAppsScript().then(remoteDb => {
        if (remoteDb && remoteDb.lastModified) {
          const remoteTime = Number(remoteDb.lastModified) || 0;
          const localTime = dbInMemory ? (Number(dbInMemory.lastModified) || 0) : 0;
          if (remoteTime > localTime) {
            dbInMemory = remoteDb;
            try {
              fs.writeFileSync(DB_FILE_PATH, JSON.stringify(remoteDb, null, 2), "utf8");
            } catch (e) {}
          }
        }
      }).catch(() => {});
    }
  });

  app.post("/api/db", (req, res) => {
    try {
      const incoming = req.body;
      if (incoming && typeof incoming === "object" && Array.isArray(incoming.teams)) {
        const incomingTime = incoming.lastModified || Date.now();
        const currentDbTime = dbInMemory ? (dbInMemory.lastModified || 0) : 0;

        if (incomingTime >= currentDbTime || !dbInMemory) {
          dbInMemory = incoming;
          try {
            fs.writeFileSync(DB_FILE_PATH, JSON.stringify(incoming, null, 2), "utf8");
          } catch (e) {
            console.error("Failed to write db.json", e);
          }

          // Asynchronously sync to centralized Google Apps Script Web App
          pushToAppsScript(incoming).catch(() => {});

          res.json({ success: true, db: dbInMemory });
        } else {
          // Incoming payload is stale
          res.json({ success: false, reason: "stale_payload", db: dbInMemory });
        }
      } else {
        res.status(400).json({ error: "Invalid data format" });
      }
    } catch (err) {
      console.error("Failed to save database", err);
      res.status(500).json({ error: "Failed to save database" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
