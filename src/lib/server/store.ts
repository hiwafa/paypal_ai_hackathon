import "server-only";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ActivityItem, Approval, Claim, LedgerEntry, Order, SupplierBill } from "@/lib/domain/types";
import { createSeedData, DB_VERSION } from "./seed";

// A tiny JSON-file store. One Node process owns the file, every mutation runs
// synchronously in memory, and writes are coalesced and made atomic with a
// temp-file rename. That is plenty for a single-shop demo and keeps the
// project free of database setup.

const MAX_ACTIVITY = 300;
const MAX_WEBHOOK_IDS = 500;
/** A demo nobody has touched for days would show an empty "today"; it starts a fresh week instead. */
const STALE_AFTER_MS = 3 * 86_400_000;
const STALE_CHECK_EVERY_MS = 60 * 60_000;

export interface Db {
  version: number;
  nextOrderNumber: number;
  orders: Order[];
  ledger: LedgerEntry[];
  approvals: Approval[];
  bills: SupplierBill[];
  claims: Claim[];
  activity: ActivityItem[];
  webhookIds: string[];
}

interface StoreState {
  db: Db;
  writeTimer: NodeJS.Timeout | null;
  writing: Promise<void>;
  staleCheckedAt: number;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Survives hot reloads in development, so the demo state isn't lost on save.
const globalStore = globalThis as typeof globalThis & { __crewosStore?: StoreState };

function loadFromDisk(): Db | null {
  try {
    if (!existsSync(DB_FILE)) return null;
    const parsed = JSON.parse(readFileSync(DB_FILE, "utf8")) as Db;
    return parsed?.version === DB_VERSION ? parsed : null;
  } catch (error) {
    console.warn("[store] Ignoring unreadable data file, reseeding.", error);
    return null;
  }
}

function isStale(db: Db, now: number): boolean {
  let newest = 0;
  for (const item of db.activity) newest = Math.max(newest, Date.parse(item.at) || 0);
  return now - newest > STALE_AFTER_MS;
}

function state(): StoreState {
  const now = Date.now();
  let s = globalStore.__crewosStore;
  if (!s) {
    const saved = loadFromDisk();
    const db = saved && !isStale(saved, now) ? saved : createSeedData(new Date(now));
    s = globalStore.__crewosStore = { db, writeTimer: null, writing: Promise.resolve(), staleCheckedAt: now };
    schedulePersist();
  } else if (now - s.staleCheckedAt > STALE_CHECK_EVERY_MS) {
    s.staleCheckedAt = now;
    if (isStale(s.db, now)) {
      s.db = createSeedData(new Date(now));
      schedulePersist();
    }
  }
  return s;
}

function schedulePersist() {
  const s = globalStore.__crewosStore;
  if (!s || s.writeTimer) return;
  s.writeTimer = setTimeout(() => {
    s.writeTimer = null;
    const snapshot = JSON.stringify(s.db);
    s.writing = s.writing
      .then(() => writeAtomically(snapshot))
      .catch((error) => {
        console.error("[store] Failed to persist data", error);
      });
  }, 40);
}

async function writeAtomically(contents: string) {
  mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${DB_FILE}.${process.pid}.tmp`;
  await writeFile(temp, contents, "utf8");
  await rename(temp, DB_FILE);
}

/** Read-only view of the data. Never mutate what this returns; use `mutate`. */
export function readDb(): Readonly<Db> {
  return state().db;
}

/** Runs a synchronous change against the data and schedules a save. */
export function mutate<T>(change: (db: Db) => T): T {
  const s = state();
  const result = change(s.db);
  if (s.db.activity.length > MAX_ACTIVITY) s.db.activity.length = MAX_ACTIVITY;
  if (s.db.webhookIds.length > MAX_WEBHOOK_IDS) {
    s.db.webhookIds.splice(0, s.db.webhookIds.length - MAX_WEBHOOK_IDS);
  }
  schedulePersist();
  return result;
}

/** Restores the seeded demo history (used before recording a demo). */
export function resetDb(): Db {
  const s = state();
  s.db = createSeedData(new Date());
  schedulePersist();
  return s.db;
}
