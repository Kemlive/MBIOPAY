import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  ordersTable,
  fraudEventsTable,
  phoneBlocklistTable,
} from "@workspace/db/schema";
import { eq, desc, count, sum } from "drizzle-orm";
import { getFlutterwaveUgxBalance } from "../lib/walletWatcher";
import { requireAdmin } from "./adminAuth";

const router = Router();

// ─── Serve admin panel HTML (no auth — login is handled client-side via session) ─
router.get("/admin-panel", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(ADMIN_HTML());
});

// ─── Overview ─────────────────────────────────────────────────────────────────
router.get("/admin/overview", requireAdmin, async (_req, res) => {
  const [userCount] = await db.select({ cnt: count() }).from(usersTable);
  const [frozenCount] = await db
    .select({ cnt: count() })
    .from(usersTable)
    .where(eq(usersTable.isFrozen, true));

  const [pendingOrders] = await db
    .select({ cnt: count() })
    .from(ordersTable)
    .where(eq(ordersTable.status, "waiting"));

  const [completedVolume] = await db
    .select({ total: sum(ordersTable.amount) })
    .from(ordersTable)
    .where(eq(ordersTable.status, "completed"));

  const [fraudCount] = await db.select({ cnt: count() }).from(fraudEventsTable);
  const [blockedPhones] = await db.select({ cnt: count() }).from(phoneBlocklistTable);

  let flwBalance = 0;
  try { flwBalance = await getFlutterwaveUgxBalance(); } catch {}

  res.json({
    users: userCount?.cnt ?? 0,
    frozenUsers: frozenCount?.cnt ?? 0,
    pendingOrders: pendingOrders?.cnt ?? 0,
    totalVolumeUsdt: parseFloat((completedVolume?.total ?? 0).toString()).toFixed(4),
    fraudEvents: fraudCount?.cnt ?? 0,
    blockedPhones: blockedPhones?.cnt ?? 0,
    flwUgxBalance: flwBalance,
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      uid: usersTable.uid,
      email: usersTable.email,
      username: usersTable.username,
      riskScore: usersTable.riskScore,
      isFrozen: usersTable.isFrozen,
      frozenReason: usersTable.frozenReason,
      frozenAt: usersTable.frozenAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.riskScore))
    .limit(100);
  res.json(users);
});

// ─── Orders ───────────────────────────────────────────────────────────────────
router.get("/admin/orders", requireAdmin, async (_req, res) => {
  const orders = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      phone: ordersTable.phone,
      network: ordersTable.network,
      amount: ordersTable.amount,
      ugxAmount: ordersTable.ugxAmount,
      status: ordersTable.status,
      txid: ordersTable.txid,
      depositAddress: ordersTable.depositAddress,
      expiresAt: ordersTable.expiresAt,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(200);
  res.json(orders);
});

// ─── Fraud events ─────────────────────────────────────────────────────────────
router.get("/admin/fraud-events", requireAdmin, async (_req, res) => {
  const events = await db
    .select()
    .from(fraudEventsTable)
    .orderBy(desc(fraudEventsTable.createdAt))
    .limit(200);
  res.json(events);
});

// ─── Blocklist ────────────────────────────────────────────────────────────────
router.get("/admin/blocklist", requireAdmin, async (_req, res) => {
  const list = await db
    .select()
    .from(phoneBlocklistTable)
    .orderBy(desc(phoneBlocklistTable.createdAt));
  res.json(list);
});

router.post("/admin/block-phone", requireAdmin, async (req, res) => {
  const { phone, reason } = req.body as { phone: string; reason?: string };
  if (!phone) { res.status(400).json({ error: "phone is required" }); return; }
  await db
    .insert(phoneBlocklistTable)
    .values({ phone, reason: reason ?? "Manual admin block", blockedBy: "admin" })
    .onConflictDoUpdate({ target: phoneBlocklistTable.phone, set: { reason: reason ?? "Manual admin block" } });
  res.json({ success: true });
});

router.delete("/admin/block-phone/:phone", requireAdmin, async (req, res) => {
  await db.delete(phoneBlocklistTable).where(eq(phoneBlocklistTable.phone, req.params.phone));
  res.json({ success: true });
});

// ─── Freeze / unfreeze ────────────────────────────────────────────────────────
router.post("/admin/freeze/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { reason } = req.body as { reason?: string };
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(usersTable).set({
    isFrozen: true, frozenAt: new Date(),
    frozenReason: reason ?? "Admin freeze", updatedAt: new Date(),
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/admin/unfreeze/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(usersTable).set({
    isFrozen: false, frozenAt: null, frozenReason: null, updatedAt: new Date(),
  }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.post("/admin/reset-risk/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(usersTable).set({ riskScore: 0, updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

export default router;

// ─── Admin panel HTML ─────────────────────────────────────────────────────────
function ADMIN_HTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MBIO PAY — Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}

/* Auth screens */
.auth-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.auth-card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:36px;width:100%;max-width:420px}
.auth-logo{text-align:center;margin-bottom:28px}
.auth-logo h1{font-size:1.5rem;font-weight:800;color:#22d3ee;letter-spacing:-.02em}
.auth-logo p{font-size:.8rem;color:#64748b;margin-top:4px}
.auth-tabs{display:flex;gap:0;margin-bottom:24px;border:1px solid #334155;border-radius:8px;overflow:hidden}
.auth-tab{flex:1;padding:8px;text-align:center;cursor:pointer;font-size:.8rem;font-weight:600;color:#64748b;background:transparent;border:none}
.auth-tab.active{background:#334155;color:#e2e8f0}
.form-group{margin-bottom:16px}
label{display:block;font-size:.75rem;font-weight:600;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
input[type=text],input[type=email],input[type=password],input[type=number]{width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;padding:10px 14px;border-radius:8px;font-size:.9rem;outline:none;transition:border-color .15s}
input:focus{border-color:#22d3ee}
.form-hint{font-size:.73rem;color:#64748b;margin-top:5px}
.btn-primary{width:100%;padding:11px;border:none;border-radius:8px;background:#22d3ee;color:#0f172a;font-weight:700;font-size:.9rem;cursor:pointer;margin-top:8px;transition:background .15s}
.btn-primary:hover{background:#06b6d4}
.btn-primary:disabled{background:#1e3a8a;color:#64748b;cursor:not-allowed}
.err-msg{background:#450a0a;border:1px solid #7f1d1d;color:#f87171;padding:10px 14px;border-radius:8px;font-size:.82rem;margin-top:12px;display:none}
.err-msg.show{display:block}
.qr-box{text-align:center;margin:16px 0}
.qr-box img{border-radius:8px;border:4px solid #334155;max-width:200px}
.secret-box{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:.8rem;color:#22d3ee;word-break:break-all;margin:8px 0}
.step-label{font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 8px}

/* Dashboard */
header{background:#1e293b;border-bottom:1px solid #334155;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}
header h1{font-size:1.1rem;font-weight:700;color:#22d3ee}
.header-right{display:flex;gap:10px;align-items:center}
.admin-email{font-size:.75rem;color:#64748b}
.tabs{display:flex;gap:2px;padding:14px 24px 0;border-bottom:1px solid #1e293b}
.tab{padding:8px 16px;border-radius:8px 8px 0 0;cursor:pointer;font-size:.82rem;color:#94a3b8;background:transparent;border:none}
.tab.active{background:#1e293b;color:#e2e8f0;font-weight:600}
.main{padding:24px}
.panel{display:none}.panel.active{display:block}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.stat{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px}
.stat-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px}
.stat-value{font-size:1.4rem;font-weight:700}
.green{color:#22d3ee}.red{color:#f87171}.yellow{color:#fbbf24}.gray{color:#64748b}
table{width:100%;border-collapse:collapse;font-size:.81rem}
th{background:#1e293b;color:#94a3b8;text-align:left;padding:9px 12px;font-weight:600;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em}
td{padding:9px 12px;border-bottom:1px solid #1e293b;vertical-align:middle}
tr:hover td{background:#1e293b55}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:.68rem;font-weight:700}
.badge-green{background:#14532d;color:#4ade80}.badge-red{background:#450a0a;color:#f87171}
.badge-yellow{background:#422006;color:#fbbf24}.badge-gray{background:#1e293b;color:#94a3b8}
.badge-blue{background:#0c1a3b;color:#60a5fa}.badge-purple{background:#2e1065;color:#c084fc}
.btn{padding:4px 10px;border-radius:6px;border:none;cursor:pointer;font-size:.72rem;font-weight:600}
.btn-red{background:#450a0a;color:#f87171}.btn-red:hover{background:#7f1d1d}
.btn-green{background:#14532d;color:#4ade80}.btn-green:hover{background:#166534}
.btn-blue{background:#0c1a3b;color:#60a5fa}.btn-blue:hover{background:#1e3a8a}
.btn-gray{background:#1e293b;color:#94a3b8;border:1px solid #334155}.btn-gray:hover{background:#334155}
.toolbar{display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap}
.toolbar input{background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:7px 12px;border-radius:8px;font-size:.81rem;outline:none;flex:1;min-width:140px}
.toolbar input:focus{border-color:#22d3ee}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden}
.risk-bar{height:5px;border-radius:3px;background:#0f172a;overflow:hidden;width:70px}
.risk-fill{height:100%;border-radius:3px}
.refresh-btn{background:#0c1a3b;color:#60a5fa;border:1px solid #1e3a8a;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:.8rem;font-weight:600}
.refresh-btn:hover{background:#1e3a8a}
.empty{text-align:center;padding:36px;color:#475569;font-size:.85rem}
.logout-btn{background:#450a0a;color:#f87171;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:.78rem;font-weight:600}
.logout-btn:hover{background:#7f1d1d}
</style>
</head>
<body>

<!-- ── AUTH SCREENS ── -->
<div id="auth-wrap" class="auth-wrap">
  <div class="auth-card">
    <div class="auth-logo">
      <h1>⚡ MBIO PAY</h1>
      <p>Admin Portal</p>
    </div>

    <div class="auth-tabs">
      <button class="auth-tab active" onclick="showAuthTab('login')">Login</button>
      <button class="auth-tab" onclick="showAuthTab('setup')">First-time Setup</button>
    </div>

    <!-- LOGIN TAB -->
    <div id="tab-login">
      <div class="form-group">
        <label>Email</label>
        <input id="l-email" type="email" placeholder="admin@mbiopay.com" autocomplete="username"/>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="l-pass" type="password" placeholder="••••••••" autocomplete="current-password"/>
      </div>
      <div class="form-group">
        <label>Authenticator Code</label>
        <input id="l-otp" type="number" placeholder="6-digit code" maxlength="6" style="letter-spacing:.2em"/>
        <div class="form-hint">Open your authenticator app and enter the current code.</div>
      </div>
      <button class="btn-primary" onclick="doLogin()" id="login-btn">Sign In</button>
      <div class="err-msg" id="login-err"></div>
    </div>

    <!-- SETUP TAB -->
    <div id="tab-setup" style="display:none">
      <p style="font-size:.8rem;color:#64748b;margin-bottom:16px">One-time setup. Only works if no admin account exists yet.</p>

      <div class="step-label">Step 1 — Generate your TOTP secret</div>
      <button class="btn-primary" onclick="generateQR()" style="margin-bottom:16px">Generate QR Code</button>
      <div id="qr-area" style="display:none">
        <div class="qr-box"><img id="qr-img" src="" alt="QR Code"/></div>
        <div class="form-hint" style="margin-bottom:6px">Scan with Google Authenticator / Authy, then save the backup key:</div>
        <div class="secret-box" id="totp-secret-display"></div>
      </div>

      <div class="step-label">Step 2 — Create your account</div>
      <div class="form-group">
        <label>Email</label>
        <input id="r-email" type="email" placeholder="admin@mbiopay.com"/>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="r-pass" type="password" placeholder="Strong password (12+ chars)"/>
      </div>
      <div class="form-group">
        <label>Confirm Authenticator Code</label>
        <input id="r-otp" type="number" placeholder="6-digit code from app"/>
        <div class="form-hint">Enter the current code from your authenticator to confirm setup.</div>
      </div>
      <button class="btn-primary" onclick="doRegister()" id="reg-btn">Create Admin Account</button>
      <div class="err-msg" id="reg-err"></div>
    </div>
  </div>
</div>

<!-- ── DASHBOARD ── -->
<div id="dashboard" style="display:none">
  <header>
    <h1>⚡ MBIO PAY Admin</h1>
    <div class="header-right">
      <span class="admin-email" id="admin-email-label"></span>
      <button class="refresh-btn" onclick="loadAll()">↻ Refresh</button>
      <button class="logout-btn" onclick="doLogout()">Logout</button>
    </div>
  </header>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('overview')">Overview</button>
    <button class="tab" onclick="switchTab('users')">Users</button>
    <button class="tab" onclick="switchTab('orders')">Orders</button>
    <button class="tab" onclick="switchTab('fraud')">Fraud Events</button>
    <button class="tab" onclick="switchTab('blocklist')">Blocklist</button>
  </div>

  <div class="main">
    <div class="panel active" id="panel-overview">
      <div class="stats" id="stats"></div>
    </div>

    <div class="panel" id="panel-users">
      <div class="toolbar">
        <input id="user-search" placeholder="Search by email or username…" oninput="filterUsers()"/>
        <button class="btn btn-gray" onclick="loadUsers()">Reload</button>
      </div>
      <div class="card"><table>
        <thead><tr><th>ID</th><th>Email</th><th>Username</th><th>Risk</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody id="users-body"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>

    <div class="panel" id="panel-orders">
      <div class="toolbar">
        <input id="order-search" placeholder="Search by phone or ID…" oninput="filterOrders()"/>
        <button class="btn btn-gray" onclick="loadOrders()">Reload</button>
      </div>
      <div class="card"><table>
        <thead><tr><th>#</th><th>User</th><th>Phone</th><th>Net</th><th>Amount</th><th>UGX</th><th>Status</th><th>Created</th></tr></thead>
        <tbody id="orders-body"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>

    <div class="panel" id="panel-fraud">
      <div class="toolbar">
        <button class="btn btn-gray" onclick="loadFraud()">Reload</button>
      </div>
      <div class="card"><table>
        <thead><tr><th>ID</th><th>User</th><th>Phone</th><th>Event</th><th>Severity</th><th>Details</th><th>Time</th></tr></thead>
        <tbody id="fraud-body"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>

    <div class="panel" id="panel-blocklist">
      <div class="toolbar">
        <input id="block-phone" placeholder="256700000000" style="flex:0 0 180px"/>
        <input id="block-reason" placeholder="Reason (optional)" style="flex:1"/>
        <button class="btn btn-red" onclick="blockPhone()">Block Phone</button>
        <button class="btn btn-gray" onclick="loadBlocklist()">Reload</button>
      </div>
      <div class="card"><table>
        <thead><tr><th>Phone</th><th>Reason</th><th>Blocked By</th><th>Date</th><th>Action</th></tr></thead>
        <tbody id="blocklist-body"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>
  </div>
</div>

<script>
// ── Device fingerprint ─────────────────────────────────────────────────────────
function getDevice() {
  return btoa(navigator.userAgent + screen.width + screen.height + navigator.language);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const api = (path, opts = {}) =>
  fetch("/api" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then(r => r.json());

let allUsers = [], allOrders = [];

function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(s) {
  const map = { completed: "badge-green", failed: "badge-red", waiting: "badge-yellow", processing: "badge-blue", expired: "badge-gray" };
  return '<span class="badge ' + (map[s] || "badge-gray") + '">' + s + "</span>";
}

function sevColor(s) {
  return { low: "#60a5fa", medium: "#fbbf24", high: "#f87171", critical: "#c026d3" }[s] || "#94a3b8";
}

function riskColor(n) {
  return n >= 80 ? "#f87171" : n >= 40 ? "#fbbf24" : "#4ade80";
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("show");
}
function hideErr(id) { document.getElementById(id).classList.remove("show"); }

// ── Auth flow ─────────────────────────────────────────────────────────────────
function showAuthTab(t) {
  document.querySelectorAll(".auth-tab").forEach((b, i) =>
    b.classList.toggle("active", ["login","setup"][i] === t));
  document.getElementById("tab-login").style.display = t === "login" ? "" : "none";
  document.getElementById("tab-setup").style.display = t === "setup" ? "" : "none";
}

async function checkSession() {
  const d = await api("/admin/session");
  if (d.authenticated) {
    document.getElementById("admin-email-label").textContent = d.email;
    showDashboard();
  }
}

function showDashboard() {
  document.getElementById("auth-wrap").style.display = "none";
  document.getElementById("dashboard").style.display = "";
  loadAll();
}

async function doLogin() {
  hideErr("login-err");
  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Signing in…";

  const d = await api("/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: document.getElementById("l-email").value,
      password: document.getElementById("l-pass").value,
      token: document.getElementById("l-otp").value,
      device: getDevice(),
    }),
  });

  btn.disabled = false;
  btn.textContent = "Sign In";

  if (d.ok) {
    document.getElementById("admin-email-label").textContent = document.getElementById("l-email").value;
    showDashboard();
  } else {
    showErr("login-err", d.error || "Login failed");
  }
}

async function doLogout() {
  await api("/admin/logout", { method: "POST" });
  location.reload();
}

// ── TOTP setup ────────────────────────────────────────────────────────────────
let generatedTotpSecret = "";

async function generateQR() {
  const d = await api("/admin/setup-totp");
  document.getElementById("qr-img").src = d.qr;
  document.getElementById("totp-secret-display").textContent = d.base32;
  document.getElementById("qr-area").style.display = "";
  generatedTotpSecret = d.base32;
}

async function doRegister() {
  hideErr("reg-err");
  if (!generatedTotpSecret) { showErr("reg-err", "Generate a QR code first."); return; }
  const btn = document.getElementById("reg-btn");
  btn.disabled = true; btn.textContent = "Creating…";

  const d = await api("/admin/register", {
    method: "POST",
    body: JSON.stringify({
      email: document.getElementById("r-email").value,
      password: document.getElementById("r-pass").value,
      totpSecret: generatedTotpSecret,
      totpToken: document.getElementById("r-otp").value,
    }),
  });

  btn.disabled = false; btn.textContent = "Create Admin Account";

  if (d.ok) {
    alert("Admin account created! You can now log in.");
    showAuthTab("login");
  } else {
    showErr("reg-err", d.error || "Registration failed");
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function switchTab(name) {
  const tabs = ["overview","users","orders","fraud","blocklist"];
  document.querySelectorAll(".tab").forEach((t, i) => t.classList.toggle("active", tabs[i] === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + name));
}

async function loadAll() {
  await Promise.all([loadOverview(), loadUsers(), loadOrders(), loadFraud(), loadBlocklist()]);
}

async function loadOverview() {
  const d = await api("/admin/overview");
  if (d.error) { location.reload(); return; }
  document.getElementById("stats").innerHTML =
    stat("Total Users", d.users, "green") +
    stat("Frozen Users", d.frozenUsers, d.frozenUsers > 0 ? "red" : "green") +
    stat("Pending Orders", d.pendingOrders, "yellow") +
    stat("Volume (USDT)", d.totalVolumeUsdt, "green") +
    stat("FLW Balance (UGX)", Number(d.flwUgxBalance).toLocaleString(), d.flwUgxBalance < 50000 ? "red" : "green") +
    stat("Fraud Events", d.fraudEvents, d.fraudEvents > 0 ? "yellow" : "green") +
    stat("Blocked Phones", d.blockedPhones, d.blockedPhones > 0 ? "red" : "gray");
}

function stat(label, value, cls) {
  return '<div class="stat"><div class="stat-label">' + label + '</div><div class="stat-value ' + cls + '">' + value + "</div></div>";
}

async function loadUsers() {
  allUsers = await api("/admin/users");
  renderUsers(allUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById("users-body");
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No users</td></tr>'; return; }
  tbody.innerHTML = users.map(u => "<tr>" +
    '<td style="color:#64748b;font-size:.72rem">' + u.id + "</td>" +
    "<td>" + u.email + "</td>" +
    '<td style="color:#94a3b8">@' + u.username + "</td>" +
    "<td><div style='display:flex;align-items:center;gap:6px'><div class='risk-bar'><div class='risk-fill' style='width:" + Math.min(u.riskScore, 100) + "%;background:" + riskColor(u.riskScore) + "'></div></div><span style='color:" + riskColor(u.riskScore) + ";font-weight:700;font-size:.78rem'>" + u.riskScore + "</span></div></td>" +
    "<td>" + (u.isFrozen ? '<span class="badge badge-red">Frozen</span>' : '<span class="badge badge-green">Active</span>') + "</td>" +
    '<td style="color:#64748b;font-size:.72rem">' + fmtTime(u.createdAt) + "</td>" +
    "<td style='display:flex;gap:4px'>" +
      (u.isFrozen
        ? '<button class="btn btn-green" onclick="unfreeze(' + u.id + ')">Unfreeze</button>'
        : '<button class="btn btn-red" onclick="freeze(' + u.id + ')">Freeze</button>') +
      ' <button class="btn btn-blue" onclick="resetRisk(' + u.id + ')">Reset Risk</button>' +
    "</td></tr>"
  ).join("");
}

function filterUsers() {
  const q = document.getElementById("user-search").value.toLowerCase();
  renderUsers(allUsers.filter(u => u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)));
}

async function loadOrders() {
  allOrders = await api("/admin/orders");
  renderOrders(allOrders);
}

function renderOrders(orders) {
  const tbody = document.getElementById("orders-body");
  if (!orders.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No orders</td></tr>'; return; }
  tbody.innerHTML = orders.map(o => "<tr>" +
    '<td style="font-family:monospace;color:#64748b">#' + String(o.id).padStart(5, "0") + "</td>" +
    '<td style="color:#64748b;font-size:.72rem">' + (o.userId || "—") + "</td>" +
    '<td style="font-family:monospace">' + o.phone + "</td>" +
    '<td><span class="badge ' + (o.network === "MTN" ? "badge-yellow" : "badge-red") + '">' + o.network + "</span></td>" +
    "<td style='font-weight:600'>" + (o.amount ? o.amount.toFixed(4) + " USDT" : "—") + "</td>" +
    '<td style="color:#22d3ee">' + (o.ugxAmount ? Number(o.ugxAmount).toLocaleString() + " UGX" : "—") + "</td>" +
    "<td>" + statusBadge(o.status) + "</td>" +
    '<td style="color:#64748b;font-size:.72rem">' + fmtTime(o.createdAt) + "</td></tr>"
  ).join("");
}

function filterOrders() {
  const q = document.getElementById("order-search").value.toLowerCase();
  renderOrders(allOrders.filter(o => o.phone.includes(q) || String(o.id).includes(q)));
}

async function loadFraud() {
  const events = await api("/admin/fraud-events");
  const tbody = document.getElementById("fraud-body");
  if (!events.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No fraud events 🎉</td></tr>'; return; }
  tbody.innerHTML = events.map(e => "<tr>" +
    '<td style="color:#64748b;font-size:.72rem">' + e.id + "</td>" +
    '<td style="color:#64748b">' + (e.userId || "—") + "</td>" +
    '<td style="font-family:monospace;font-size:.72rem">' + (e.phone || "—") + "</td>" +
    "<td style='font-weight:600;font-size:.78rem'>" + e.eventType.replace(/_/g, " ") + "</td>" +
    '<td style="font-weight:700;font-size:.72rem;color:' + sevColor(e.severity) + '">' + e.severity.toUpperCase() + "</td>" +
    '<td style="color:#64748b;font-size:.7rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + JSON.stringify(e.details) + "</td>" +
    '<td style="color:#64748b;font-size:.72rem">' + fmtTime(e.createdAt) + "</td></tr>"
  ).join("");
}

async function loadBlocklist() {
  const list = await api("/admin/blocklist");
  const tbody = document.getElementById("blocklist-body");
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No blocked phones</td></tr>'; return; }
  tbody.innerHTML = list.map(b => "<tr>" +
    "<td style='font-family:monospace;font-weight:600'>" + b.phone + "</td>" +
    "<td>" + b.reason + "</td>" +
    '<td style="color:#64748b">' + b.blockedBy + "</td>" +
    '<td style="color:#64748b;font-size:.72rem">' + fmtTime(b.createdAt) + "</td>" +
    '<td><button class="btn btn-green" onclick="unblockPhone(\'' + b.phone + '\')">Unblock</button></td></tr>'
  ).join("");
}

async function freeze(id) {
  const reason = prompt("Freeze reason:", "Admin freeze") ?? "Admin freeze";
  await api("/admin/freeze/" + id, { method: "POST", body: JSON.stringify({ reason }) });
  loadUsers(); loadOverview();
}

async function unfreeze(id) {
  await api("/admin/unfreeze/" + id, { method: "POST", body: "{}" });
  loadUsers(); loadOverview();
}

async function resetRisk(id) {
  if (!confirm("Reset risk score for user " + id + "?")) return;
  await api("/admin/reset-risk/" + id, { method: "POST", body: "{}" });
  loadUsers();
}

async function blockPhone() {
  const phone = document.getElementById("block-phone").value.trim();
  const reason = document.getElementById("block-reason").value.trim() || "Manual admin block";
  if (!phone) { alert("Enter a phone number"); return; }
  await api("/admin/block-phone", { method: "POST", body: JSON.stringify({ phone, reason }) });
  document.getElementById("block-phone").value = "";
  document.getElementById("block-reason").value = "";
  loadBlocklist(); loadOverview();
}

async function unblockPhone(phone) {
  if (!confirm("Unblock " + phone + "?")) return;
  await fetch("/api/admin/block-phone/" + encodeURIComponent(phone), { method: "DELETE", credentials: "include" });
  loadBlocklist(); loadOverview();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("keydown", e => { if (e.key === "Enter") {
  if (document.getElementById("tab-login").style.display !== "none") doLogin();
}});

checkSession();
setInterval(() => { if (document.getElementById("dashboard").style.display !== "none") loadOverview(); }, 30000);
</script>
</body>
</html>`;
}
