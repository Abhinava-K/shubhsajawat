/**
 * Shubh Sajawat Fullstack Web App Client Script
 * Communicates with the Node.js / Express REST API with JWT Authentication & RBAC
 */

const API_BASE = '/api';
let currentUser = null;
let authToken = localStorage.getItem('token') || null;

// In-memory cache synced from REST API
let serverData = {
  challans: [],
  catalog: [],
  users: [],
  history: []
};

const todayStr = new Date().toISOString().slice(0, 10);

// ----------------------------------------------------
// API Request Helper
// ----------------------------------------------------

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      // Unauthorized -> redirect to login
      handleLogout();
      throw new Error(data.error || 'Session expired. Please sign in.');
    }

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// ----------------------------------------------------
// Authentication Handlers
// ----------------------------------------------------

function switchAuthTab(tab) {
  const loginContainer = document.getElementById("loginFormContainer");
  const registerContainer = document.getElementById("registerFormContainer");
  const forgotContainer = document.getElementById("forgotFormContainer");
  const tabBtnLogin = document.getElementById("tabBtnLogin");
  const tabBtnRegister = document.getElementById("tabBtnRegister");
  const tabBtnForgot = document.getElementById("tabBtnForgot");

  if (loginContainer) loginContainer.style.display = 'none';
  if (registerContainer) registerContainer.style.display = 'none';
  if (forgotContainer) forgotContainer.style.display = 'none';

  if (tabBtnLogin) tabBtnLogin.classList.remove('active');
  if (tabBtnRegister) tabBtnRegister.classList.remove('active');
  if (tabBtnForgot) {
    tabBtnForgot.classList.remove('active');
    tabBtnForgot.style.display = (tab === 'forgot') ? 'inline-block' : 'none';
  }

  if (tab === 'login') {
    if (loginContainer) loginContainer.style.display = 'block';
    if (tabBtnLogin) tabBtnLogin.classList.add('active');
  } else if (tab === 'register') {
    if (registerContainer) registerContainer.style.display = 'block';
    if (tabBtnRegister) tabBtnRegister.classList.add('active');
  } else if (tab === 'forgot') {
    if (forgotContainer) forgotContainer.style.display = 'block';
    if (tabBtnForgot) tabBtnForgot.classList.add('active');
  }
}

async function handleForgotPasswordSubmit(e) {
  e.preventDefault();
  const phone = document.getElementById("forgot_phone").value.trim();
  const newPassword = document.getElementById("forgot_new_password").value;
  const confirmPassword = document.getElementById("forgot_confirm_password").value;

  if (newPassword !== confirmPassword) {
    showToast("Passwords do not match. Please verify.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: phone, phone, newPassword })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password reset failed.');

    showToast(data.message || 'Password reset successfully!');
    switchAuthTab('login');
    const authIdInput = document.getElementById("auth_identifier");
    if (authIdInput) authIdInput.value = phone;
  } catch (err) {
    showToast(err.message);
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const identifier = document.getElementById("auth_identifier").value.trim();
  const password = document.getElementById("auth_password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    authToken = data.token;
    localStorage.setItem('token', authToken);
    currentUser = data.user;

    showToast(`Welcome back, ${currentUser.name}! Role: ${currentUser.role.toUpperCase()}`);
    initAuthenticatedSession();
  } catch (err) {
    showToast(err.message);
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("reg_name").value.trim();
  const phone = document.getElementById("reg_phone").value.trim();
  const email = document.getElementById("reg_email").value.trim();
  const password = document.getElementById("reg_password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed.');

    authToken = data.token;
    localStorage.setItem('token', authToken);
    currentUser = data.user;

    showToast(data.message);
    initAuthenticatedSession();
  } catch (err) {
    showToast(err.message);
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('token');
  document.getElementById("mainApp").style.display = "none";
  document.getElementById("authScreen").style.display = "flex";
  switchAuthTab('login');
}

async function checkAuthSession() {
  if (!authToken) {
    document.getElementById("authScreen").style.display = "flex";
    document.getElementById("mainApp").style.display = "none";
    return;
  }

  try {
    const data = await apiRequest('/auth/me');
    currentUser = data.user;
    initAuthenticatedSession();
  } catch (e) {
    handleLogout();
  }
}

function initAuthenticatedSession() {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("mainApp").style.display = "flex";

  updateProfileHeaderWidget();
  loadAllData();
  navigateTo("dashboard");
}

function updateProfileHeaderWidget() {
  if (!currentUser) return;
  const initial = (currentUser.name || "U").charAt(0).toUpperCase();
  document.getElementById("userAvatarInitials").textContent = initial;
  document.getElementById("userNameLabel").textContent = currentUser.name;

  const roleBadge = document.getElementById("userRoleBadge");
  roleBadge.textContent = currentUser.role.toUpperCase();
  roleBadge.className = `profile-role-badge role-${currentUser.role}`;

  // Admin user management nav
  const navUser = document.getElementById("navUserManagement");
  if (navUser) {
    navUser.style.display = (currentUser.role === 'admin') ? 'flex' : 'none';
  }

  // Disable / enable actions based on role
  const isViewer = currentUser.role === 'viewer';
  const newChallanBtn = document.getElementById("headerNewChallanBtn");
  const btnNewChallanInPage = document.getElementById("btnNewChallanInPage");
  const btnNewDispatchInSites = document.getElementById("btnNewDispatchInSites");
  const btnAddCatalog = document.getElementById("btnAddCatalogItem");

  if (newChallanBtn) {
    newChallanBtn.style.display = isViewer ? 'none' : 'inline-flex';
  }
  if (btnNewChallanInPage) {
    btnNewChallanInPage.style.display = isViewer ? 'none' : 'inline-flex';
  }
  if (btnNewDispatchInSites) {
    btnNewDispatchInSites.style.display = isViewer ? 'none' : 'inline-flex';
  }
  if (btnAddCatalog) {
    btnAddCatalog.style.display = (currentUser.role === 'admin') ? 'inline-flex' : 'none';
  }
}

// ----------------------------------------------------
// UI Helpers & Modals
// ----------------------------------------------------

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function showToast(msg) {
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>✓</span> <div>${esc(msg)}</div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function closeModal() {
  document.getElementById("mainModalBackdrop").classList.remove("active");
  document.getElementById("modalContentContainer").innerHTML = "";
}

function openModal(html, isLarge = false) {
  const backdrop = document.getElementById("mainModalBackdrop");
  const container = document.getElementById("modalContentContainer");
  container.className = "modal-container" + (isLarge ? " large" : "");
  container.innerHTML = html;
  backdrop.classList.add("active");
}

function toggleMobileSidebar() {
  document.getElementById("appSidebar").classList.toggle("open");
}

// ----------------------------------------------------
// Navigation & Views
// ----------------------------------------------------

let currentPage = "dashboard";
function navigateTo(pageId) {
  currentPage = pageId;
  document.querySelectorAll(".page-view").forEach(p => p.style.display = "none");
  const target = document.getElementById("page_" + pageId);
  if (target) target.style.display = "block";

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  const pageHeaders = {
    dashboard: { title: "Executive Dashboard", desc: "Real-time overview of active dispatches, sites, and inventory health." },
    challans: { title: "Digital Challan Book", desc: "View, create, and print direct loading area challans." },
    sites: { title: "Active Event Sites", desc: "Track current material balances deployed across event venues." },
    returns: { title: "Material Returns & Reconciliation", desc: "Receive incoming returns and reconcile shortages or damages." },
    inventory: { title: "Master Material Catalog", desc: "Available warehouse stock, size specs, and in-field distribution." },
    users: { title: "User & Role Administration", desc: "Fetch registered staff, upgrade viewers to loaders, and control access." },
    history: { title: "Movement Audit Trail", desc: "Permanent record of all material dispatches, returns, and damages." }
  };

  const info = pageHeaders[pageId] || { title: "Dashboard", desc: "" };
  document.getElementById("pageMainTitle").textContent = info.title;
  document.getElementById("pageSubtitle").textContent = info.desc;

  renderCurrentPage();
  document.getElementById("appSidebar").classList.remove("open");
}

async function loadAllData() {
  try {
    const [challanRes, inventoryRes, historyRes] = await Promise.all([
      apiRequest('/challans'),
      apiRequest('/inventory'),
      apiRequest('/history')
    ]);

    serverData.challans = challanRes.challans || [];
    serverData.catalog = inventoryRes.catalog || [];
    serverData.history = historyRes.history || [];

    if (currentUser && currentUser.role === 'admin') {
      fetchUsers();
    }

    renderCurrentPage();
  } catch (err) {
    console.error("Data load error:", err);
  }
}

function renderCurrentPage() {
  switch (currentPage) {
    case "dashboard": renderDashboardView(); break;
    case "challans": renderChallansView(); break;
    case "sites": renderSitesView(); break;
    case "returns": renderReturnsView(); break;
    case "inventory": renderInventoryView(); break;
    case "users": renderUsersView(); break;
    case "history": renderHistoryView(); break;
  }
}

// Outstanding calculations
function getChallanOutstanding(challan) {
  return challan.items.map(it => {
    const returned = it.returnedQty || 0;
    const damaged = it.lossOrDamageQty || 0;
    const out = Math.max(0, it.quantity - returned - damaged);
    return { ...it, outstanding: out };
  });
}

function getChallanTotalOutstanding(challan) {
  return getChallanOutstanding(challan).reduce((acc, it) => acc + it.outstanding, 0);
}

// 1. Dashboard View
function renderDashboardView() {
  const activeChallans = serverData.challans.filter(c => getChallanTotalOutstanding(c) > 0);
  const totalItemsOut = activeChallans.reduce((acc, c) => acc + getChallanTotalOutstanding(c), 0);
  const overdueChallans = activeChallans.filter(c => new Date(c.dueDate) < new Date(todayStr)).length;
  const totalCatalogUnits = serverData.catalog.reduce((acc, it) => acc + it.totalStock, 0);

  document.getElementById("kpiActiveSites").textContent = activeChallans.length;
  document.getElementById("kpiItemsOut").textContent = totalItemsOut;
  document.getElementById("kpiOverdue").textContent = overdueChallans;
  document.getElementById("kpiTotalCatalog").textContent = totalCatalogUnits;

  // Active sites preview table
  const tbodySites = document.getElementById("dashActiveSitesBody");
  if (activeChallans.length === 0) {
    tbodySites.innerHTML = `<tr><td colspan="5" class="empty-state">No active sites currently out.</td></tr>`;
  } else {
    tbodySites.innerHTML = activeChallans.slice(0, 5).map(c => {
      const isOverdue = new Date(c.dueDate) < new Date(todayStr);
      const outCount = getChallanTotalOutstanding(c);
      return `
        <tr>
          <td>
            <strong>${esc(c.clientName)}</strong><br>
            <span style="font-size:12px;color:var(--text-muted)">${esc(c.venue)}</span>
          </td>
          <td><span class="badge badge-gray">${esc(c.id)}</span></td>
          <td><strong>${outCount}</strong> units out</td>
          <td>${c.dueDate}</td>
          <td>
            <span class="badge ${isOverdue ? 'badge-red' : 'badge-green'}">
              ${isOverdue ? 'Overdue' : 'Active'}
            </span>
          </td>
        </tr>
      `;
    }).join("");
  }

  // Recent Movements table
  const tbodyHistory = document.getElementById("dashMovementBody");
  const recents = serverData.history.slice(-5).reverse();
  if (recents.length === 0) {
    tbodyHistory.innerHTML = `<tr><td colspan="5" class="empty-state">No movement logged yet.</td></tr>`;
  } else {
    tbodyHistory.innerHTML = recents.map(h => `
      <tr>
        <td>${h.date}</td>
        <td><strong>${esc(h.itemName)}</strong></td>
        <td>${esc(h.to)}</td>
        <td><span class="badge ${h.type === 'Dispatch' ? 'badge-blue' : 'badge-green'}">${h.type}</span></td>
        <td><strong>${h.qty}</strong></td>
      </tr>
    `).join("");
  }
}

// 2. Challans View
function renderChallansView() {
  const query = (document.getElementById("challanSearchInput")?.value || "").toLowerCase();
  const statusFilter = document.getElementById("challanStatusFilter")?.value || "ALL";

  let list = serverData.challans.filter(c => {
    const text = (c.id + " " + c.clientName + " " + c.venue + " " + c.dispatcherName).toLowerCase();
    const matchesQuery = text.includes(query);
    if (!matchesQuery) return false;
    if (statusFilter === "ACTIVE") return getChallanTotalOutstanding(c) > 0;
    if (statusFilter === "RETURNED") return getChallanTotalOutstanding(c) === 0;
    if (statusFilter === "OVERDUE") return (new Date(c.dueDate) < new Date(todayStr)) && getChallanTotalOutstanding(c) > 0;
    return true;
  });

  const tbody = document.getElementById("challanTableBody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No digital challans match your filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.slice().reverse().map(c => {
    const outCount = getChallanTotalOutstanding(c);
    const isOverdue = (new Date(c.dueDate) < new Date(todayStr)) && outCount > 0;
    const statusBadge = outCount === 0 
      ? `<span class="badge badge-gray">Fully Returned</span>`
      : (isOverdue 
        ? `<span class="badge badge-red">Overdue (${outCount} out)</span>` 
        : `<span class="badge badge-blue">At Site (${outCount} out)</span>`);

    const canOperate = currentUser && (currentUser.role === 'admin' || currentUser.role === 'loader');

    return `
      <tr>
        <td><strong>${esc(c.id)}</strong></td>
        <td>
          <strong>${esc(c.clientName)}</strong><br>
          <span style="font-size:12px;color:var(--text-muted)">${esc(c.venue)}</span>
        </td>
        <td>${c.dispatchDate}</td>
        <td>${c.dueDate}</td>
        <td><strong>${c.totalItemsCount}</strong> items</td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" onclick="viewChallanSlip('${c.id}')">🖶 View / Print</button>
            ${canOperate && outCount > 0 ? `<button class="btn btn-primary btn-sm" onclick="openReturnModalForChallan('${c.id}')">Receive Return</button>` : ''}
            ${currentUser && currentUser.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteChallan('${c.id}')">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// 3. Active Sites View
function renderSitesView() {
  const grid = document.getElementById("sitesGridContainer");
  const activeChallans = serverData.challans.filter(c => getChallanTotalOutstanding(c) > 0);

  if (activeChallans.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No materials currently deployed on event sites.</div>`;
    return;
  }

  const canOperate = currentUser && (currentUser.role === 'admin' || currentUser.role === 'loader');

  grid.innerHTML = activeChallans.map(c => {
    const outCount = getChallanTotalOutstanding(c);
    const isOverdue = new Date(c.dueDate) < new Date(todayStr);

    return `
      <div class="site-card">
        <div class="site-card-header">
          <div>
            <h3>${esc(c.clientName)}</h3>
            <div class="site-venue">📍 ${esc(c.venue)}</div>
          </div>
          <span class="badge ${isOverdue ? 'badge-red' : 'badge-blue'}">
            ${isOverdue ? 'Overdue' : 'On Site'}
          </span>
        </div>

        <div class="site-stats-banner">
          <div>
            <div class="label">Items At Venue</div>
            <div class="num">${outCount}</div>
          </div>
          <div style="text-align:right">
            <div class="label">Total Dispatched</div>
            <div style="font-weight:700;font-size:16px;">${c.totalItemsCount}</div>
          </div>
        </div>

        <div class="site-meta-rows">
          <div class="site-meta-row">
            <span style="color:var(--text-muted)">Challan No:</span>
            <strong>${esc(c.id)}</strong>
          </div>
          <div class="site-meta-row">
            <span style="color:var(--text-muted)">Dispatch Date:</span>
            <span>${c.dispatchDate}</span>
          </div>
          <div class="site-meta-row">
            <span style="color:var(--text-muted)">Expected Return:</span>
            <strong>${c.dueDate}</strong>
          </div>
          <div class="site-meta-row">
            <span style="color:var(--text-muted)">Loaded By:</span>
            <span>${esc(c.dispatcherName)}</span>
          </div>
        </div>

        <div class="site-actions">
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="viewChallanSlip('${c.id}')">View Challan</button>
          ${canOperate ? `<button class="btn btn-primary btn-sm" style="flex:1" onclick="openReturnModalForChallan('${c.id}')">Process Return</button>` : ''}
        </div>
      </div>
    `;
  }).join("");
}

// 4. Returns View
function renderReturnsView() {
  const tbody = document.getElementById("returnsTableBody");
  const pendingChallans = serverData.challans.filter(c => getChallanTotalOutstanding(c) > 0);

  if (pendingChallans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">All dispatches have been fully returned. No pending items.</td></tr>`;
    return;
  }

  const canOperate = currentUser && (currentUser.role === 'admin' || currentUser.role === 'loader');

  tbody.innerHTML = pendingChallans.map(c => {
    const outItems = getChallanOutstanding(c).filter(it => it.outstanding > 0);
    const outTotal = outItems.reduce((a, b) => a + b.outstanding, 0);
    const isOverdue = new Date(c.dueDate) < new Date(todayStr);

    return `
      <tr>
        <td><strong>${esc(c.id)}</strong></td>
        <td>
          <strong>${esc(c.clientName)}</strong><br>
          <span style="font-size:12px;color:var(--text-muted)">${esc(c.venue)}</span>
        </td>
        <td><strong>${outTotal}</strong> items out (${outItems.length} lines)</td>
        <td>${c.dueDate}</td>
        <td>
          <span class="badge ${isOverdue ? 'badge-red' : 'badge-amber'}">
            ${isOverdue ? 'Overdue' : 'Pending Return'}
          </span>
        </td>
        <td>
          ${canOperate 
            ? `<button class="btn btn-primary btn-sm" onclick="openReturnModalForChallan('${c.id}')">Receive Items</button>` 
            : `<button class="btn btn-secondary btn-sm" onclick="viewChallanSlip('${c.id}')">View Details</button>`}
        </td>
      </tr>
    `;
  }).join("");
}

// 5. Master Inventory Catalog View
function renderInventoryView() {
  const query = (document.getElementById("inventorySearchInput")?.value || "").toLowerCase();
  const category = document.getElementById("inventoryCategoryFilter")?.value || "ALL";

  const list = serverData.catalog.filter(it => {
    const matchesQuery = it.name.toLowerCase().includes(query) || it.category.toLowerCase().includes(query);
    const matchesCat = category === "ALL" || it.category === category;
    return matchesQuery && matchesCat;
  });

  const tbody = document.getElementById("inventoryTableBody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No materials found matching search.</td></tr>`;
    return;
  }

  const isAdminUser = currentUser && currentUser.role === 'admin';

  tbody.innerHTML = list.map(it => {
    return `
      <tr>
        <td><strong>${esc(it.name)}</strong></td>
        <td><span class="badge badge-gray">${esc(it.category)}</span></td>
        <td><span style="font-size:12px;color:var(--text-muted)">${(it.sizes || []).join(", ") || "Standard"}</span></td>
        <td><strong>${it.totalStock}</strong></td>
        <td><span style="color:var(--warning);font-weight:700">${it.inField || 0}</span></td>
        <td><span style="color:var(--success);font-weight:700">${it.available || 0}</span></td>
        <td>
          ${isAdminUser 
            ? `<button class="btn btn-secondary btn-sm" onclick="openEditCatalogModal('${it.id}')">Edit Stock</button>` 
            : `<span style="font-size:12px;color:var(--text-muted)">Read-only</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

// 6. User Management View (Admin only)
async function fetchUsers() {
  if (!currentUser || currentUser.role !== 'admin') return;
  try {
    const data = await apiRequest('/admin/users');
    serverData.users = data.users || [];
    renderUsersView();
  } catch (err) {
    console.error("Fetch users error:", err);
    showToast(err.message || 'Failed to fetch registered users.');
  }
}

function renderUsersView() {
  if (!currentUser || currentUser.role !== 'admin') {
    const tbody = document.getElementById("usersTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Access Restricted: Only Administrators can manage users.</td></tr>`;
    return;
  }

  const allUsers = serverData.users || [];

  // Update KPI counters
  const totalUsersEl = document.getElementById("kpiTotalUsers");
  const adminUsersEl = document.getElementById("kpiAdminUsers");
  const loaderUsersEl = document.getElementById("kpiLoaderUsers");
  const viewerUsersEl = document.getElementById("kpiViewerUsers");

  if (totalUsersEl) totalUsersEl.textContent = allUsers.length;
  if (adminUsersEl) adminUsersEl.textContent = allUsers.filter(u => u.role === 'admin').length;
  if (loaderUsersEl) loaderUsersEl.textContent = allUsers.filter(u => u.role === 'loader').length;
  if (viewerUsersEl) viewerUsersEl.textContent = allUsers.filter(u => u.role === 'viewer').length;

  const searchQuery = (document.getElementById("userSearchInput")?.value || "").trim().toLowerCase();
  const roleFilter = document.getElementById("userRoleFilter")?.value || "ALL";

  const filteredUsers = allUsers.filter(u => {
    const text = ((u.name || '') + " " + (u.phone || '') + " " + (u.email || '')).toLowerCase();
    const matchSearch = !searchQuery || text.includes(searchQuery);
    const matchRole = (roleFilter === "ALL" || u.role === roleFilter);
    return matchSearch && matchRole;
  });

  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  if (filteredUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${allUsers.length === 0 ? 'No staff members registered yet. Users will appear here when they register.' : 'No users match the search and filter criteria.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredUsers.map(u => {
    const isSelf = u.id === currentUser.id;
    const formattedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "—";

    return `
      <tr>
        <td>
          <div style="font-weight:600;font-size:13.5px;color:var(--text-main);">${esc(u.name)}</div>
          ${isSelf ? '<span class="badge badge-blue" style="margin-top:2px;font-size:10.5px;">Current Session (You)</span>' : ''}
        </td>
        <td>
          <div style="font-weight:500;">${esc(u.phone || '—')}</div>
          <div style="font-size:12px;color:var(--text-muted);">${esc(u.email || '—')}</div>
        </td>
        <td>
          <span class="profile-role-badge role-${u.role}">${u.role.toUpperCase()}</span>
        </td>
        <td><span style="font-size:12.5px;color:var(--text-muted);">${formattedDate}</span></td>
        <td>
          <span class="badge ${u.status === 'Active' ? 'badge-green' : 'badge-red'}">${u.status || 'Active'}</span>
        </td>
        <td>
          ${!isSelf ? `
            <div style="display:flex;gap:6px;align-items:center;">
              <select class="filter-select" style="padding:5px 10px;font-size:12px;font-weight:500;border-radius:6px;" onchange="promptRoleChange('${u.id}', this.value, this)">
                <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer (Read-Only)</option>
                <option value="loader" ${u.role === 'loader' ? 'selected' : ''}>Loader (Dock Operations)</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator (Full Access)</option>
              </select>
            </div>
          ` : '<span style="font-size:12px;color:var(--text-muted);font-weight:500;">Active Admin</span>'}
        </td>
      </tr>
    `;
  }).join("");
}

function promptRoleChange(userId, targetRole, selectElement) {
  const userObj = serverData.users.find(u => u.id === userId);
  if (!userObj) return;

  if (userObj.role === targetRole) return;

  // If cancelled later, revert dropdown
  const currentRole = userObj.role;

  let roleTitle = "";
  let roleDesc = "";
  let badgeClass = "";
  let alertBox = "";

  if (targetRole === 'admin') {
    roleTitle = "Administrator (Full Control)";
    badgeClass = "role-admin";
    roleDesc = "Grants unrestricted access across the system, including managing staff roles, adding/editing/deleting catalog inventory, deleting challans, and full operational permissions.";
    alertBox = `
      <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px 14px;border-radius:8px;margin-top:14px;font-size:12.5px;color:#991b1b;display:flex;gap:10px;align-items:flex-start;">
        <span style="font-size:16px;">⚠️</span>
        <div><strong>Caution:</strong> Administrators hold full authority over all data and permissions. Ensure this user is trusted.</div>
      </div>
    `;
  } else if (targetRole === 'loader') {
    roleTitle = "Loader (Loading Dock Area)";
    badgeClass = "role-loader";
    roleDesc = "Grants operational permissions to generate digital loading challans, dispatch material to event sites, record incoming site returns, and log item shortages or damage.";
    alertBox = `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px 14px;border-radius:8px;margin-top:14px;font-size:12.5px;color:#1e40af;display:flex;gap:10px;align-items:flex-start;">
        <span style="font-size:16px;">🚚</span>
        <div><strong>Operational Role:</strong> This will allow <strong>${esc(userObj.name)}</strong> to create challans and restock material on the loading dock.</div>
      </div>
    `;
  } else {
    roleTitle = "Viewer (Read-Only Access)";
    badgeClass = "role-viewer";
    roleDesc = "Restricts the user strictly to view-only mode. They can browse challans, inventory, and movement trails, but cannot create challans, return materials, or alter catalog items.";
  }

  const modalHtml = `
    <div class="modal-header">
      <div>
        <h2 style="font-size:18px;margin-bottom:3px;">Confirm Role Modification</h2>
        <span style="font-size:12.5px;color:var(--text-muted)">Staff Access Control</span>
      </div>
      <button class="modal-close" onclick="cancelRoleChange('${userId}')">×</button>
    </div>

    <div class="modal-body" style="padding:20px;">
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text-main);">${esc(userObj.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);">${esc(userObj.phone || '')} • ${esc(userObj.email || '')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="profile-role-badge role-${currentRole}">${currentRole.toUpperCase()}</span>
            <span style="color:var(--text-muted);font-weight:700;">➔</span>
            <span class="profile-role-badge ${badgeClass}">${targetRole.toUpperCase()}</span>
          </div>
        </div>

        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">
          <strong>Permission Scope:</strong> ${roleDesc}
        </div>
      </div>

      ${alertBox}

      <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:10px;">
        <button type="button" class="btn btn-secondary" onclick="cancelRoleChange('${userId}')">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="executeRoleChange('${userId}', '${targetRole}')">
          ✓ Confirm & Grant ${targetRole.toUpperCase()} Role
        </button>
      </div>
    </div>
  `;

  openModal(modalHtml);
}

function cancelRoleChange(userId) {
  closeModal();
  renderUsersView();
}

async function executeRoleChange(userId, newRole) {
  try {
    const res = await apiRequest(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole })
    });
    closeModal();
    showToast(res.message || 'User role successfully updated.');
    await fetchUsers();
  } catch (err) {
    showToast(err.message || 'Failed to update user role.');
    renderUsersView();
  }
}

// 7. Movement History View
function renderHistoryView() {
  const query = (document.getElementById("historySearchInput")?.value || "").toLowerCase();
  const typeFilter = document.getElementById("historyTypeFilter")?.value || "ALL";

  const list = serverData.history.filter(h => {
    const text = (h.date + " " + h.itemName + " " + h.from + " " + h.to + " " + (h.operator || '') + " " + (h.refId || "")).toLowerCase();
    const matchesQuery = text.includes(query);
    const matchesType = typeFilter === "ALL" || h.type === typeFilter;
    return matchesQuery && matchesType;
  });

  const tbody = document.getElementById("historyTableBody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No movement history entries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.slice().reverse().map(h => {
    const typeBadge = h.type === 'Dispatch' 
      ? `<span class="badge badge-blue">Dispatch</span>`
      : (h.type === 'Return' ? `<span class="badge badge-green">Return</span>` : `<span class="badge badge-red">Shortage/Damage</span>`);

    return `
      <tr>
        <td>${h.date}</td>
        <td><strong>${esc(h.itemName)}</strong></td>
        <td>${esc(h.from)}</td>
        <td>${esc(h.to)}</td>
        <td><strong>${h.qty}</strong></td>
        <td>${typeBadge}</td>
        <td><span style="font-size:12px;color:var(--text-muted)">${esc(h.operator || '—')}</span></td>
      </tr>
    `;
  }).join("");
}

// ----------------------------------------------------
// Digital Challan Creator Modal (Matching Excel Format)
// ----------------------------------------------------

let currentChallanItems = [];

function openNewChallanModal() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'loader')) {
    showToast("Access Denied: Only Loaders and Admins can create digital challans.");
    return;
  }

  currentChallanItems = [
    { srNo: 1, itemName: "", size: "", quantity: 1, remark: "" },
    { srNo: 2, itemName: "", size: "", quantity: 1, remark: "" },
    { srNo: 3, itemName: "", size: "", quantity: 1, remark: "" }
  ];

  const html = `
    <div class="modal-header">
      <h2>+ New Digital Dispatch Challan (SHUBH SAJAWAT)</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid three-cols">
        <div class="form-group">
          <label class="form-label">Client Name <span class="req">*</span></label>
          <input id="nc_client" class="form-control" placeholder="e.g. Anna Prashan ( Data Houses )" required>
        </div>
        <div class="form-group">
          <label class="form-label">Venue / Event Location <span class="req">*</span></label>
          <input id="nc_venue" class="form-control" placeholder="e.g. Grand Hyatt Lawn" required>
        </div>
        <div class="form-group">
          <label class="form-label">Loading Operator (Dispatcher)</label>
          <input id="nc_dispatcher" class="form-control" value="${esc(currentUser.name)}" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">Dispatch Date <span class="req">*</span></label>
          <input id="nc_dispatch_date" type="date" class="form-control" value="${todayStr}">
        </div>
        <div class="form-group">
          <label class="form-label">Due / Expected Return Date <span class="req">*</span></label>
          <input id="nc_due_date" type="date" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Total No. of Items</label>
          <input id="nc_total_count" class="form-control" value="0" readonly style="font-weight:700;background:#f8fafc">
        </div>
      </div>

      <div class="challan-items-section">
        <div class="challan-items-header">
          <span>MATERIAL ITEMS LIST (DIRECT LOADING ENTRY)</span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="addChallanItemRow()">+ Add Item Line</button>
        </div>
        <div class="challan-item-row head">
          <div class="sr">Sr.No</div>
          <div>Item Image / Name</div>
          <div>Size</div>
          <div>Quantity</div>
          <div>Remark</div>
          <div></div>
        </div>
        <div id="challanItemsContainer">
          ${renderChallanFormRows()}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitNewChallan()">Generate &amp; Save Challan</button>
    </div>
  `;

  openModal(html, true);
  recalcTotalCount();
}

function renderChallanFormRows() {
  const catalogDatalist = `
    <datalist id="catalogNamesList">
      ${serverData.catalog.map(c => `<option value="${esc(c.name)}">${esc(c.category)}</option>`).join("")}
    </datalist>
  `;

  return currentChallanItems.map((item, idx) => `
    <div class="challan-item-row" data-idx="${idx}">
      <div class="sr">${idx + 1}</div>
      <div>
        <input type="text" list="catalogNamesList" class="form-control ci-name" placeholder="Type or select material..." value="${esc(item.itemName)}" oninput="updateRowItem(${idx}, 'itemName', this.value)">
      </div>
      <div>
        <input type="text" class="form-control ci-size" placeholder="Size (e.g. 8*4, 1 Ft)" value="${esc(item.size)}" oninput="updateRowItem(${idx}, 'size', this.value)">
      </div>
      <div>
        <input type="number" min="1" class="form-control ci-qty" value="${item.quantity || 1}" oninput="updateRowItem(${idx}, 'quantity', this.value)">
      </div>
      <div>
        <input type="text" class="form-control ci-remark" placeholder="Remark / placement note" value="${esc(item.remark)}" oninput="updateRowItem(${idx}, 'remark', this.value)">
      </div>
      <div>
        <button type="button" class="btn-remove-row" onclick="removeChallanItemRow(${idx})">✕</button>
      </div>
    </div>
  `).join("") + catalogDatalist;
}

function updateRowItem(idx, field, val) {
  if (currentChallanItems[idx]) {
    if (field === 'quantity') {
      currentChallanItems[idx][field] = Math.max(1, parseInt(val) || 1);
    } else {
      currentChallanItems[idx][field] = val;
    }

    if (field === 'itemName') {
      const match = serverData.catalog.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
      if (match && match.sizes && match.sizes.length > 0 && !currentChallanItems[idx].size) {
        currentChallanItems[idx].size = match.sizes[0];
        const row = document.querySelector(`.challan-item-row[data-idx="${idx}"] .ci-size`);
        if (row) row.value = match.sizes[0];
      }
    }
  }
  recalcTotalCount();
}

function addChallanItemRow() {
  currentChallanItems.push({
    srNo: currentChallanItems.length + 1,
    itemName: "",
    size: "",
    quantity: 1,
    remark: ""
  });
  document.getElementById("challanItemsContainer").innerHTML = renderChallanFormRows();
  recalcTotalCount();
}

function removeChallanItemRow(idx) {
  if (currentChallanItems.length <= 1) {
    showToast("Challan must have at least one item line.");
    return;
  }
  currentChallanItems.splice(idx, 1);
  document.getElementById("challanItemsContainer").innerHTML = renderChallanFormRows();
  recalcTotalCount();
}

function recalcTotalCount() {
  const total = currentChallanItems.reduce((sum, it) => sum + (parseInt(it.quantity) || 0), 0);
  const el = document.getElementById("nc_total_count");
  if (el) el.value = total;
}

async function submitNewChallan() {
  const clientName = document.getElementById("nc_client").value.trim();
  const venue = document.getElementById("nc_venue").value.trim();
  const dispatchDate = document.getElementById("nc_dispatch_date").value || todayStr;
  const dueDate = document.getElementById("nc_due_date").value || dispatchDate;

  if (!clientName || !venue) {
    showToast("Client Name and Venue are required.");
    return;
  }

  const validItems = currentChallanItems.filter(it => it.itemName.trim() !== "").map((it, i) => ({
    srNo: i + 1,
    itemName: it.itemName.trim(),
    size: it.size.trim(),
    quantity: parseInt(it.quantity) || 1,
    remark: it.remark.trim()
  }));

  if (validItems.length === 0) {
    showToast("Please enter at least one material line.");
    return;
  }

  try {
    const res = await apiRequest('/challans', {
      method: 'POST',
      body: JSON.stringify({
        clientName,
        venue,
        dispatchDate,
        dueDate,
        items: validItems
      })
    });

    showToast(res.message);
    closeModal();
    await loadAllData();

    if (res.challan) {
      setTimeout(() => viewChallanSlip(res.challan.id), 400);
    }
  } catch (err) {
    showToast(err.message);
  }
}

// ----------------------------------------------------
// View & Print Official Shubh Sajawat Challan Slip
// ----------------------------------------------------

function viewChallanSlip(challanId) {
  const c = serverData.challans.find(x => x.id === challanId);
  if (!c) return;

  const html = `
    <div class="modal-header no-print">
      <h2>Digital Challan Slip — ${esc(c.id)}</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="window.print()">🖶 Print Challan Slip</button>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
    </div>
    <div class="modal-body">
      <div class="printable-challan-container">
        <div class="printable-challan">
          <div class="challan-slip-header">
            SHUBH SAJAWAT CHALLAN
          </div>
          <div class="challan-slip-info">
            <div class="challan-slip-info-row">
              <div class="challan-info-label">Client Name:</div>
              <div class="challan-info-value">${esc(c.clientName)}</div>
            </div>
            <div class="challan-slip-info-row">
              <div class="challan-info-label">Venue / Event:</div>
              <div class="challan-info-value">${esc(c.venue)}</div>
            </div>
            <div class="challan-slip-info-row">
              <div class="challan-info-label">Dispatch Date:</div>
              <div class="challan-info-value">${c.dispatchDate}</div>
            </div>
            <div class="challan-slip-info-row">
              <div class="challan-info-label">Due / Return Date:</div>
              <div class="challan-info-value">${c.dueDate}</div>
            </div>
            <div class="challan-slip-info-row">
              <div class="challan-info-label">Total No. of items:</div>
              <div class="challan-info-value"><strong>${c.totalItemsCount}</strong></div>
            </div>
          </div>

          <table class="challan-table">
            <thead>
              <tr>
                <th style="width:45px;" class="blue-header">Sr.No</th>
                <th class="blue-header">Item Image / Name</th>
                <th style="width:110px;">Size</th>
                <th style="width:90px;">Quantity</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              ${c.items.map((it, i) => `
                <tr>
                  <td style="text-align:center;font-weight:700;">${i + 1}</td>
                  <td><strong>${esc(it.itemName)}</strong></td>
                  <td style="text-align:center;">${esc(it.size || "—")}</td>
                  <td style="text-align:center;font-weight:700;">${it.quantity} ${it.unit || ''}</td>
                  <td>${esc(it.remark || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="challan-slip-footer">
            <div class="signature-box">
              <div style="margin-bottom:30px;color:#64748b;">(Loaded by: ${esc(c.dispatcherName)})</div>
              <div>SHUBH SAJAWAT SIGN:</div>
            </div>
            <div class="signature-box">
              <div style="margin-bottom:30px;color:#64748b;">(Received at site)</div>
              <div>RECEIVER SIGN:</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer no-print">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="window.print()">Print Slip</button>
    </div>
  `;

  openModal(html, true);
}

// ----------------------------------------------------
// Return Material & Reconciliation Modal
// ----------------------------------------------------

function openReturnModalForChallan(challanId) {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'loader')) {
    showToast("Access Denied: Only Loaders and Admins can process returns.");
    return;
  }

  const c = serverData.challans.find(x => x.id === challanId);
  if (!c) return;

  const outItems = getChallanOutstanding(c).filter(it => it.outstanding > 0);
  if (outItems.length === 0) {
    showToast("All items for this challan have already been returned.");
    return;
  }

  const html = `
    <div class="modal-header">
      <h2>Receive Material Return — ${esc(c.clientName)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text-muted);margin-bottom:16px;font-size:13px;">
        Challan <strong>${esc(c.id)}</strong> | Venue: <strong>${esc(c.venue)}</strong>
      </p>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Size</th>
              <th>Total Sent</th>
              <th>Currently Out</th>
              <th style="width:130px;">Return Qty</th>
              <th style="width:110px;">Damaged / Lost</th>
            </tr>
          </thead>
          <tbody>
            ${outItems.map((it, idx) => `
              <tr data-sr="${it.srNo}">
                <td><strong>${esc(it.itemName)}</strong></td>
                <td>${esc(it.size || "—")}</td>
                <td>${it.quantity}</td>
                <td><strong style="color:var(--primary);">${it.outstanding}</strong></td>
                <td>
                  <input type="number" class="form-control ret-good-qty" min="0" max="${it.outstanding}" value="${it.outstanding}">
                </td>
                <td>
                  <input type="number" class="form-control ret-dmg-qty" min="0" max="${it.outstanding}" value="0">
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="form-group full" style="margin-top:16px;">
        <label class="form-label">Return Note / Condition Remarks</label>
        <textarea id="returnIntakeNotes" class="form-control" style="min-height:70px;" placeholder="e.g. All chairs received in good condition, 1 floral stand slightly bent."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitReturnProcessing('${c.id}')">Confirm &amp; Receive to Warehouse</button>
    </div>
  `;

  openModal(html, true);
}

async function submitReturnProcessing(challanId) {
  const rows = document.querySelectorAll("#modalContentContainer tbody tr");
  const returnsPayload = [];

  rows.forEach(row => {
    const srNo = parseInt(row.dataset.sr);
    const returnedQty = parseInt(row.querySelector(".ret-good-qty").value) || 0;
    const damageQty = parseInt(row.querySelector(".ret-dmg-qty").value) || 0;

    if (returnedQty > 0 || damageQty > 0) {
      returnsPayload.push({ srNo, returnedQty, damageQty });
    }
  });

  if (returnsPayload.length === 0) {
    showToast("Please enter returned or damaged quantities.");
    return;
  }

  try {
    const res = await apiRequest(`/challans/${challanId}/returns`, {
      method: 'POST',
      body: JSON.stringify({
        returns: returnsPayload,
        notes: document.getElementById("returnIntakeNotes")?.value || ""
      })
    });

    showToast(res.message);
    closeModal();
    await loadAllData();
  } catch (err) {
    showToast(err.message);
  }
}

// ----------------------------------------------------
// Master Inventory Stock Edit Modal (Admin only)
// ----------------------------------------------------

function openEditCatalogModal(itemId) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast("Access Denied: Only Admins can edit inventory stock.");
    return;
  }

  const it = serverData.catalog.find(x => x.id === itemId);
  if (!it) return;

  const html = `
    <div class="modal-header">
      <h2>Edit Material Stock — ${esc(it.name)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Material Name</label>
          <input id="cat_name" class="form-control" value="${esc(it.name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <input id="cat_category" class="form-control" value="${esc(it.category)}">
        </div>
        <div class="form-group">
          <label class="form-label">Total Warehouse Stock Units</label>
          <input id="cat_stock" type="number" min="0" class="form-control" value="${it.totalStock}">
        </div>
        <div class="form-group">
          <label class="form-label">Size Variations (comma-separated)</label>
          <input id="cat_sizes" class="form-control" value="${esc((it.sizes || []).join(", "))}">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCatalogItem('${it.id}')">Save Changes</button>
    </div>
  `;

  openModal(html);
}

async function saveCatalogItem(itemId) {
  const name = document.getElementById("cat_name").value.trim();
  const category = document.getElementById("cat_category").value.trim();
  const totalStock = parseInt(document.getElementById("cat_stock").value) || 0;
  const sizesRaw = document.getElementById("cat_sizes").value;

  if (!name) {
    showToast("Material name is required.");
    return;
  }

  const sizes = sizesRaw.split(",").map(s => s.trim()).filter(Boolean);

  try {
    const res = await apiRequest(`/inventory/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, category, totalStock, sizes })
    });

    showToast(res.message);
    closeModal();
    await loadAllData();
  } catch (err) {
    showToast(err.message);
  }
}

function openAddNewCatalogModal() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast("Access Denied: Only Admins can add new materials.");
    return;
  }

  const html = `
    <div class="modal-header">
      <h2>+ Add New Material to Catalog</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Material Name <span class="req">*</span></label>
          <input id="new_cat_name" class="form-control" placeholder="e.g. Maharaja Sofa" required>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="new_cat_category" class="form-control">
            <option value="Furniture">Furniture</option>
            <option value="Structures">Structures &amp; Frames</option>
            <option value="Artifacts">Artifacts &amp; Props</option>
            <option value="Brass & Metal">Brass &amp; Metal</option>
            <option value="Fabrics">Fabrics &amp; Drapes</option>
            <option value="Lighting">Lighting &amp; Electricals</option>
            <option value="Consumables">Consumables</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Initial Warehouse Stock <span class="req">*</span></label>
          <input id="new_cat_stock" type="number" min="1" value="10" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">Size Variations (comma-separated)</label>
          <input id="new_cat_sizes" class="form-control" placeholder="e.g. Standard, 8*4, 1 Ft">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitNewCatalogItem()">Add to Master Catalog</button>
    </div>
  `;

  openModal(html);
}

async function submitNewCatalogItem() {
  const name = document.getElementById("new_cat_name").value.trim();
  const category = document.getElementById("new_cat_category").value;
  const totalStock = parseInt(document.getElementById("new_cat_stock").value) || 1;
  const sizesRaw = document.getElementById("new_cat_sizes").value;

  if (!name) {
    showToast("Material name is required.");
    return;
  }

  const sizes = sizesRaw.split(",").map(s => s.trim()).filter(Boolean);

  try {
    const res = await apiRequest('/inventory', {
      method: 'POST',
      body: JSON.stringify({ name, category, totalStock, sizes: sizes.length > 0 ? sizes : ['Standard'] })
    });

    showToast(res.message);
    closeModal();
    await loadAllData();
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteChallan(challanId) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast("Only Admins can delete challan records.");
    return;
  }
  if (!confirm(`Are you sure you want to permanently delete Challan ${challanId}?`)) return;

  try {
    const res = await apiRequest(`/challans/${challanId}`, { method: 'DELETE' });
    showToast(res.message);
    await loadAllData();
  } catch (err) {
    showToast(err.message);
  }
}

// ----------------------------------------------------
// Initialization
// ----------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.page);
    });
  });

  checkAuthSession();
});
