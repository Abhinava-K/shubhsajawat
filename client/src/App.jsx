import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  LayoutDashboard,
  FileSpreadsheet,
  MapPin,
  RotateCcw,
  Boxes,
  Users,
  History,
  Plus,
  Printer,
  Trash2,
  LogOut,
  Menu,
  X,
  Search,
  CheckCircle,
  AlertTriangle,
  Package
} from 'lucide-react';

function MainApp() {
  const { user, token, logout, isAdmin, isLoader, isViewer, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // App Data State
  const [challans, setChallans] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [history, setHistory] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Modals State
  const [newChallanOpen, setNewChallanOpen] = useState(false);
  const [printSlipChallan, setPrintSlipChallan] = useState(null);
  const [returnChallan, setReturnChallan] = useState(null);
  const [newMaterialOpen, setNewMaterialOpen] = useState(false);
  const [editMaterialItem, setEditMaterialItem] = useState(null);
  const [roleConfirmTarget, setRoleConfirmTarget] = useState(null);

  // Filter States
  const [challanSearch, setChallanSearch] = useState('');
  const [challanFilter, setChallanFilter] = useState('ALL');
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('ALL');
  const [histSearch, setHistSearch] = useState('');
  const [histType, setHistType] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');

  const todayStr = new Date().toISOString().slice(0, 10);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  // API Call helper
  const apiFetch = async (endpoint, options = {}) => {
    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  // Load Data
  const loadData = async () => {
    if (!token) return;
    try {
      const [chData, invData, histData] = await Promise.all([
        apiFetch('/challans'),
        apiFetch('/inventory'),
        apiFetch('/history')
      ]);
      setChallans(chData.challans || []);
      setCatalog(invData.catalog || []);
      setHistory(histData.history || []);

      if (user?.role === 'admin') {
        loadUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiFetch('/admin/users');
      setUsersList(data.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, user]);

  // Helpers for calculations
  const getChallanOutstanding = (ch) => {
    return (ch.items || []).map(it => {
      const returned = it.returnedQty || 0;
      const damaged = it.lossOrDamageQty || 0;
      const out = Math.max(0, it.quantity - returned - damaged);
      return { ...it, outstanding: out };
    });
  };

  const getChallanTotalOut = (ch) => {
    return getChallanOutstanding(ch).reduce((acc, it) => acc + it.outstanding, 0);
  };

  // ----------------------------------------------------
  // Render Views
  // ----------------------------------------------------

  const renderDashboard = () => {
    const activeChallans = challans.filter(c => getChallanTotalOut(c) > 0);
    const totalOut = activeChallans.reduce((acc, c) => acc + getChallanTotalOut(c), 0);
    const overdueCount = activeChallans.filter(c => new Date(c.dueDate) < new Date(todayStr)).length;
    const totalStock = catalog.reduce((acc, it) => acc + it.totalStock, 0);

    return (
      <div>
        <div className="stats-grid">
          <div className="stat-card">
            <div>
              <div className="stat-title">Active Sites</div>
              <div className="stat-val">{activeChallans.length}</div>
              <div className="stat-meta">Venues currently holding decor</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <MapPin size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-title">Materials Out on Site</div>
              <div className="stat-val" style={{ color: '#d97706' }}>{totalOut}</div>
              <div className="stat-meta">Total units outside warehouse</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Package size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-title">Overdue Returns</div>
              <div className="stat-val" style={{ color: '#dc2626' }}>{overdueCount}</div>
              <div className="stat-meta">Sites past scheduled return date</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-title">Master Catalog Stock</div>
              <div className="stat-val">{totalStock}</div>
              <div className="stat-meta">Total managed inventory units</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <Boxes size={22} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          <div className="card-section">
            <div className="card-header">
              <h2>Active Event Deployments</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('sites')}>
                View All Sites →
              </button>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client / Venue</th>
                    <th>Challan ID</th>
                    <th>Material Out</th>
                    <th>Return Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeChallans.length === 0 ? (
                    <tr><td colSpan="5" className="empty-state">No active sites currently out.</td></tr>
                  ) : (
                    activeChallans.slice(0, 5).map(c => {
                      const isOverdue = new Date(c.dueDate) < new Date(todayStr);
                      const out = getChallanTotalOut(c);
                      return (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.clientName}</strong><br />
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.venue}</span>
                          </td>
                          <td><span className="badge badge-gray">{c.id}</span></td>
                          <td><strong>{out}</strong> units</td>
                          <td>{c.dueDate}</td>
                          <td>
                            <span className={`badge ${isOverdue ? 'badge-red' : 'badge-green'}`}>
                              {isOverdue ? 'Overdue' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-section">
            <div className="card-header">
              <h2>Recent Movements</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('history')}>
                Audit Trail →
              </button>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Material</th>
                    <th>Destination</th>
                    <th>Type</th>
                    <th>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan="5" className="empty-state">No movement logged yet.</td></tr>
                  ) : (
                    history.slice(-5).reverse().map(h => (
                      <tr key={h.id || h.date + h.itemName}>
                        <td>{h.date}</td>
                        <td><strong>{h.itemName}</strong></td>
                        <td>{h.to}</td>
                        <td>
                          <span className={`badge ${h.type === 'Dispatch' ? 'badge-blue' : (h.type === 'Return' ? 'badge-green' : 'badge-red')}`}>
                            {h.type}
                          </span>
                        </td>
                        <td><strong>{h.qty}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderChallans = () => {
    const list = challans.filter(c => {
      const text = `${c.id} ${c.clientName} ${c.venue} ${c.dispatcherName}`.toLowerCase();
      const matchQ = text.includes(challanSearch.toLowerCase());
      if (!matchQ) return false;
      const out = getChallanTotalOut(c);
      if (challanFilter === 'ACTIVE') return out > 0;
      if (challanFilter === 'RETURNED') return out === 0;
      if (challanFilter === 'OVERDUE') return new Date(c.dueDate) < new Date(todayStr) && out > 0;
      return true;
    });

    return (
      <div>
        <div className="toolbar">
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search by Client, Venue, Challan ID, or Loader..."
              value={challanSearch}
              onChange={(e) => setChallanSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <select
              className="filter-select"
              value={challanFilter}
              onChange={(e) => setChallanFilter(e.target.value)}
            >
              <option value="ALL">All Challans</option>
              <option value="ACTIVE">Active (At Site)</option>
              <option value="OVERDUE">Overdue</option>
              <option value="RETURNED">Fully Returned</option>
            </select>
            {isLoader && (
              <button className="btn btn-primary" onClick={() => setNewChallanOpen(true)}>
                <Plus size={16} /> New Loading Challan
              </button>
            )}
          </div>
        </div>

        <div className="card-section">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Challan No.</th>
                  <th>Client &amp; Venue</th>
                  <th>Dispatch Date</th>
                  <th>Due Date</th>
                  <th>Items Loaded</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No challans found.</td></tr>
                ) : (
                  list.slice().reverse().map(c => {
                    const out = getChallanTotalOut(c);
                    const isOverdue = new Date(c.dueDate) < new Date(todayStr) && out > 0;
                    return (
                      <tr key={c.id}>
                        <td><strong>{c.id}</strong></td>
                        <td>
                          <strong>{c.clientName}</strong><br />
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.venue}</span>
                        </td>
                        <td>{c.dispatchDate}</td>
                        <td>{c.dueDate}</td>
                        <td><strong>{c.totalItemsCount}</strong> items</td>
                        <td>
                          <span className={`badge ${out === 0 ? 'badge-gray' : (isOverdue ? 'badge-red' : 'badge-blue')}`}>
                            {out === 0 ? 'Fully Returned' : (isOverdue ? `Overdue (${out} out)` : `At Site (${out} out)`)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPrintSlipChallan(c)}>
                              <Printer size={13} /> View Slip
                            </button>
                            {isLoader && out > 0 && (
                              <button className="btn btn-primary btn-sm" onClick={() => setReturnChallan(c)}>
                                Receive Return
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={async () => {
                                  if (!confirm(`Delete Challan ${c.id}?`)) return;
                                  try {
                                    await apiFetch(`/challans/${c.id}`, { method: 'DELETE' });
                                    showToast('Challan deleted');
                                    loadData();
                                  } catch (e) {
                                    showToast(e.message);
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSites = () => {
    const active = challans.filter(c => getChallanTotalOut(c) > 0);

    return (
      <div>
        <div className="toolbar">
          <div></div>
          {isLoader && (
            <button className="btn btn-primary" onClick={() => setNewChallanOpen(true)}>
              <Plus size={16} /> New Dispatch to Site
            </button>
          )}
        </div>

        <div className="sites-grid">
          {active.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              No materials currently deployed on event sites.
            </div>
          ) : (
            active.map(c => {
              const out = getChallanTotalOut(c);
              const isOverdue = new Date(c.dueDate) < new Date(todayStr);

              return (
                <div className="site-card" key={c.id}>
                  <div className="site-card-header">
                    <div>
                      <h3>{c.clientName}</h3>
                      <div className="site-venue">📍 {c.venue}</div>
                    </div>
                    <span className={`badge ${isOverdue ? 'badge-red' : 'badge-blue'}`}>
                      {isOverdue ? 'Overdue' : 'On Site'}
                    </span>
                  </div>

                  <div className="site-stats-banner">
                    <div>
                      <div className="label">Items At Venue</div>
                      <div className="num">{out}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="label">Total Dispatched</div>
                      <div style={{ fontWeight: 700, fontSize: '16px' }}>{c.totalItemsCount}</div>
                    </div>
                  </div>

                  <div className="site-meta-rows">
                    <div className="site-meta-row">
                      <span style={{ color: 'var(--text-muted)' }}>Challan No:</span>
                      <strong>{c.id}</strong>
                    </div>
                    <div className="site-meta-row">
                      <span style={{ color: 'var(--text-muted)' }}>Expected Return:</span>
                      <strong>{c.dueDate}</strong>
                    </div>
                    <div className="site-meta-row">
                      <span style={{ color: 'var(--text-muted)' }}>Loaded By:</span>
                      <span>{c.dispatcherName}</span>
                    </div>
                  </div>

                  <div className="site-actions">
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setPrintSlipChallan(c)}>
                      View Challan
                    </button>
                    {isLoader && (
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setReturnChallan(c)}>
                        Process Return
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderReturns = () => {
    const pending = challans.filter(c => getChallanTotalOut(c) > 0);

    return (
      <div className="card-section">
        <div className="card-header">
          <h2>Pending Event Site Returns</h2>
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Receive incoming materials and account for damage or shortage
          </span>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Challan ID</th>
                <th>Client &amp; Venue</th>
                <th>Materials Outside</th>
                <th>Expected Return</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan="6" className="empty-state">All dispatches have been fully returned.</td></tr>
              ) : (
                pending.map(c => {
                  const outItems = getChallanOutstanding(c).filter(it => it.outstanding > 0);
                  const totalOut = outItems.reduce((a, b) => a + b.outstanding, 0);
                  const isOverdue = new Date(c.dueDate) < new Date(todayStr);

                  return (
                    <tr key={c.id}>
                      <td><strong>{c.id}</strong></td>
                      <td>
                        <strong>{c.clientName}</strong><br />
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.venue}</span>
                      </td>
                      <td><strong>{totalOut}</strong> units out ({outItems.length} lines)</td>
                      <td>{c.dueDate}</td>
                      <td>
                        <span className={`badge ${isOverdue ? 'badge-red' : 'badge-amber'}`}>
                          {isOverdue ? 'Overdue' : 'Pending Return'}
                        </span>
                      </td>
                      <td>
                        {isLoader ? (
                          <button className="btn btn-primary btn-sm" onClick={() => setReturnChallan(c)}>
                            Receive Items
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => setPrintSlipChallan(c)}>
                            View Slip
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    const list = catalog.filter(it => {
      const matchQ = it.name.toLowerCase().includes(invSearch.toLowerCase()) || it.category.toLowerCase().includes(invSearch.toLowerCase());
      const matchCat = invCategory === 'ALL' || it.category === invCategory;
      return matchQ && matchCat;
    });

    return (
      <div>
        <div className="toolbar">
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search catalog materials..."
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <select className="filter-select" value={invCategory} onChange={(e) => setInvCategory(e.target.value)}>
              <option value="ALL">All Categories</option>
              <option value="Furniture">Furniture</option>
              <option value="Structures">Structures &amp; Frames</option>
              <option value="Artifacts">Artifacts &amp; Props</option>
              <option value="Brass & Metal">Brass &amp; Metal</option>
              <option value="Fabrics">Fabrics</option>
              <option value="Lighting">Lighting</option>
              <option value="Consumables">Consumables</option>
            </select>
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => setNewMaterialOpen(true)}>
                <Plus size={16} /> Add New Material
              </button>
            )}
          </div>
        </div>

        <div className="card-section">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Item</th>
                  <th>Category</th>
                  <th>Size Specifications</th>
                  <th>Total Stock</th>
                  <th>At Event Sites</th>
                  <th>In Warehouse (Available)</th>
                  <th>Admin Action</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No materials found.</td></tr>
                ) : (
                  list.map(it => (
                    <tr key={it.id}>
                      <td><strong>{it.name}</strong></td>
                      <td><span className="badge badge-gray">{it.category}</span></td>
                      <td><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(it.sizes || []).join(', ') || 'Standard'}</span></td>
                      <td><strong>{it.totalStock}</strong></td>
                      <td><span style={{ color: 'var(--warning)', fontWeight: 700 }}>{it.inField || 0}</span></td>
                      <td><span style={{ color: 'var(--success)', fontWeight: 700 }}>{it.available || 0}</span></td>
                      <td>
                        {isAdmin ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditMaterialItem(it)}>
                            Edit Stock
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    if (!isAdmin) {
      return <div className="empty-state">Access Denied: Administrator role required.</div>;
    }

    const totalCount = usersList.length;
    const adminCount = usersList.filter(u => u.role === 'admin').length;
    const loaderCount = usersList.filter(u => u.role === 'loader').length;
    const viewerCount = usersList.filter(u => u.role === 'viewer').length;

    const filteredUsers = usersList.filter(u => {
      const text = `${u.name || ''} ${u.phone || ''} ${u.email || ''}`.toLowerCase();
      const matchSearch = !userSearch || text.includes(userSearch.toLowerCase());
      const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      return matchSearch && matchRole;
    });

    return (
      <div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
          <div className="stat-card">
            <div>
              <div className="stat-title">Total Users</div>
              <div className="stat-val">{totalCount}</div>
              <div className="stat-meta">Registered accounts</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>👥</div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-title">Administrators</div>
              <div className="stat-val" style={{ color: '#7c3aed' }}>{adminCount}</div>
              <div className="stat-meta">Full system control</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>🔑</div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-title">Loaders</div>
              <div className="stat-val" style={{ color: '#0284c7' }}>{loaderCount}</div>
              <div className="stat-meta">Loading dock dispatches</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#f0f9ff', color: '#0284c7' }}>🚚</div>
          </div>
          <div className="stat-card">
            <div>
              <div className="stat-title">Viewers</div>
              <div className="stat-val" style={{ color: '#64748b' }}>{viewerCount}</div>
              <div className="stat-meta">Read-only accounts</div>
            </div>
            <div className="stat-icon-wrap" style={{ background: '#f1f5f9', color: '#64748b' }}>👁️</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search users by name, phone, or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <select className="filter-select" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
              <option value="ALL">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="loader">Loaders</option>
              <option value="viewer">Viewers</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={loadUsers}>
              ↻ Refresh Users
            </button>
          </div>
        </div>

        <div className="card-section">
          <div className="card-header">
            <div>
              <h2>Registered Staff &amp; Access Control</h2>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Grant Admin or Loader privileges to registered viewers with explicit confirmation
              </span>
            </div>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Contact Info</th>
                  <th>Current Role</th>
                  <th>Registered On</th>
                  <th>Status</th>
                  <th>Grant Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      {usersList.length === 0 ? 'No registered users found in database.' : 'No users match the search and filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const isSelf = u.id === user.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                          {isSelf && <span className="badge badge-blue" style={{ marginLeft: '6px' }}>Current Session (You)</span>}
                        </td>
                        <td>
                          <span>{u.phone || '—'}</span><br />
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{u.email || '—'}</span>
                        </td>
                        <td><span className={`profile-role-badge role-${u.role}`}>{u.role.toUpperCase()}</span></td>
                        <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                        <td><span className={`badge ${u.status === 'Active' ? 'badge-green' : 'badge-red'}`}>{u.status || 'Active'}</span></td>
                        <td>
                          {!isSelf ? (
                            <select
                              className="filter-select"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              value={u.role}
                              onChange={(e) => {
                                const targetRole = e.target.value;
                                if (targetRole !== u.role) {
                                  setRoleConfirmTarget({ user: u, targetRole });
                                }
                              }}
                            >
                              <option value="viewer">Viewer (Read-Only)</option>
                              <option value="loader">Loader (Dock Operations)</option>
                              <option value="admin">Administrator (Full Control)</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Admin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    const list = history.filter(h => {
      const text = `${h.date} ${h.itemName} ${h.from} ${h.to} ${h.operator} ${h.refId}`.toLowerCase();
      const matchQ = text.includes(histSearch.toLowerCase());
      const matchType = histType === 'ALL' || h.type === histType;
      return matchQ && matchType;
    });

    return (
      <div>
        <div className="toolbar">
          <div className="search-input-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search audit trail..."
              value={histSearch}
              onChange={(e) => setHistSearch(e.target.value)}
            />
          </div>

          <select className="filter-select" value={histType} onChange={(e) => setHistType(e.target.value)}>
            <option value="ALL">All Movements</option>
            <option value="Dispatch">Dispatches (Out)</option>
            <option value="Return">Returns (In)</option>
            <option value="Damage">Damage / Shortage</option>
          </select>
        </div>

        <div className="card-section">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material / Challan</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Quantity</th>
                  <th>Movement Type</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No history recorded.</td></tr>
                ) : (
                  list.slice().reverse().map(h => (
                    <tr key={h.id || h.date + h.itemName}>
                      <td>{h.date}</td>
                      <td><strong>{h.itemName}</strong></td>
                      <td>{h.from}</td>
                      <td>{h.to}</td>
                      <td><strong>{h.qty}</strong></td>
                      <td>
                        <span className={`badge ${h.type === 'Dispatch' ? 'badge-blue' : (h.type === 'Return' ? 'badge-green' : 'badge-red')}`}>
                          {h.type}
                        </span>
                      </td>
                      <td><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.operator || '—'}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast-container">
          <div className="toast">
            <CheckCircle size={18} />
            <div>{toastMsg}</div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="brand-section">
          <div className="brand-logo">SS</div>
          <div className="brand-info">
            <h2>SHUBH SAJAWAT</h2>
            <span>Material &amp; Challan Tracker</span>
          </div>
        </div>

        <nav className="nav-links">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button className={`nav-item ${activeTab === 'challans' ? 'active' : ''}`} onClick={() => { setActiveTab('challans'); setMobileMenuOpen(false); }}>
            <FileSpreadsheet size={18} />
            <span>Digital Challans</span>
          </button>

          <button className={`nav-item ${activeTab === 'sites' ? 'active' : ''}`} onClick={() => { setActiveTab('sites'); setMobileMenuOpen(false); }}>
            <MapPin size={18} />
            <span>Active Event Sites</span>
          </button>

          <button className={`nav-item ${activeTab === 'returns' ? 'active' : ''}`} onClick={() => { setActiveTab('returns'); setMobileMenuOpen(false); }}>
            <RotateCcw size={18} />
            <span>Returns &amp; Shortages</span>
          </button>

          <button className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => { setActiveTab('inventory'); setMobileMenuOpen(false); }}>
            <Boxes size={18} />
            <span>Master Catalog</span>
          </button>

          {isAdmin && (
            <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}>
              <Users size={18} />
              <span>User &amp; Role Admin</span>
            </button>
          )}

          <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); setMobileMenuOpen(false); }}>
            <History size={18} />
            <span>Movement Audit Log</span>
          </button>
        </nav>

        <div className="user-profile-widget">
          <div className="profile-card">
            <div className="avatar">{(user?.name || 'U').charAt(0).toUpperCase()}</div>
            <div className="profile-details">
              <div className="profile-name">{user?.name}</div>
              <span className={`profile-role-badge role-${user?.role}`}>{user?.role?.toUpperCase()}</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '10px' }} onClick={logout}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="top-header">
          <div className="header-left">
            <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu size={20} />
            </button>
            <div className="page-titles">
              <h1>
                {activeTab === 'dashboard' && 'Executive Dashboard'}
                {activeTab === 'challans' && 'Digital Challan Book'}
                {activeTab === 'sites' && 'Active Event Sites'}
                {activeTab === 'returns' && 'Material Returns & Reconciliation'}
                {activeTab === 'inventory' && 'Master Material Catalog'}
                {activeTab === 'users' && 'User & Role Administration (MongoDB)'}
                {activeTab === 'history' && 'Movement Audit Trail'}
              </h1>
              <p>Real-time MERN stack material tracker with direct loading dock entry.</p>
            </div>
          </div>

          <div className="header-actions">
            {isLoader && (
              <button className="btn btn-primary" onClick={() => setNewChallanOpen(true)}>
                <Plus size={16} /> New Loading Challan
              </button>
            )}
          </div>
        </header>

        <main className="content-body">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'challans' && renderChallans()}
          {activeTab === 'sites' && renderSites()}
          {activeTab === 'returns' && renderReturns()}
          {activeTab === 'inventory' && renderInventory()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'history' && renderHistory()}
        </main>
      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. New Challan Modal */}
      {newChallanOpen && (
        <NewChallanModal
          catalog={catalog}
          onClose={() => setNewChallanOpen(false)}
          onSuccess={(newCh) => {
            setNewChallanOpen(false);
            showToast('Challan created successfully');
            loadData();
            setPrintSlipChallan(newCh);
          }}
          apiFetch={apiFetch}
          showToast={showToast}
        />
      )}

      {/* 2. Official Printable Challan Slip Modal */}
      {printSlipChallan && (
        <ChallanSlipModal
          challan={printSlipChallan}
          onClose={() => setPrintSlipChallan(null)}
        />
      )}

      {/* 3. Return Intake Modal */}
      {returnChallan && (
        <ReturnModal
          challan={returnChallan}
          onClose={() => setReturnChallan(null)}
          onSuccess={() => {
            setReturnChallan(null);
            showToast('Return recorded and restocked to warehouse');
            loadData();
          }}
          apiFetch={apiFetch}
          showToast={showToast}
        />
      )}

      {/* 4. Add / Edit Material Modal */}
      {newMaterialOpen && (
        <NewMaterialModal
          onClose={() => setNewMaterialOpen(false)}
          onSuccess={() => {
            setNewMaterialOpen(false);
            showToast('Material added to master catalog');
            loadData();
          }}
          apiFetch={apiFetch}
          showToast={showToast}
        />
      )}

      {editMaterialItem && (
        <EditMaterialModal
          item={editMaterialItem}
          onClose={() => setEditMaterialItem(null)}
          onSuccess={() => {
            setEditMaterialItem(null);
            showToast('Catalog stock updated');
            loadData();
          }}
          apiFetch={apiFetch}
          showToast={showToast}
        />
      )}

      {/* 5. Role Change Confirmation Modal */}
      {roleConfirmTarget && (
        <RoleConfirmModal
          target={roleConfirmTarget}
          onClose={() => setRoleConfirmTarget(null)}
          onConfirm={async (targetRole) => {
            try {
              const res = await apiFetch(`/admin/users/${roleConfirmTarget.user.id}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ role: targetRole })
              });
              showToast(res.message || 'User role successfully updated');
              setRoleConfirmTarget(null);
              loadUsers();
            } catch (err) {
              showToast(err.message || 'Failed to update role');
            }
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// Role Change Confirmation Modal Component
// ----------------------------------------------------

function RoleConfirmModal({ target, onClose, onConfirm }) {
  const { user: targetUser, targetRole } = target;
  const currentRole = targetUser.role;

  let roleTitle = "";
  let roleDesc = "";
  let badgeClass = "";
  let alertBox = null;

  if (targetRole === 'admin') {
    roleTitle = "Administrator (Full Control)";
    badgeClass = "role-admin";
    roleDesc = "Grants unrestricted access across the system, including managing staff roles, adding/editing/deleting catalog inventory, deleting challans, and full operational permissions.";
    alertBox = (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 14px', borderRadius: '8px', marginTop: '14px', fontSize: '12.5px', color: '#991b1b', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '16px' }}>⚠️</span>
        <div><strong>Caution:</strong> Administrators hold full authority over all data and permissions. Ensure this user is trusted.</div>
      </div>
    );
  } else if (targetRole === 'loader') {
    roleTitle = "Loader (Loading Dock Area)";
    badgeClass = "role-loader";
    roleDesc = "Grants operational permissions to generate digital loading challans, dispatch material to event sites, record incoming site returns, and log item shortages or damage.";
    alertBox = (
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 14px', borderRadius: '8px', marginTop: '14px', fontSize: '12.5px', color: '#1e40af', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '16px' }}>🚚</span>
        <div><strong>Operational Role:</strong> This will allow <strong>{targetUser.name}</strong> to create challans and restock material on the loading dock.</div>
      </div>
    );
  } else {
    roleTitle = "Viewer (Read-Only Access)";
    badgeClass = "role-viewer";
    roleDesc = "Restricts the user strictly to view-only mode. They can browse challans, inventory, and movement trails, but cannot create challans, return materials, or alter catalog items.";
  }

  return (
    <div className="modal-backdrop active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '18px', marginBottom: '3px' }}>Confirm Role Modification</h2>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Staff Access Control</span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>{targetUser.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{targetUser.phone || ''} {targetUser.email ? `• ${targetUser.email}` : ''}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`profile-role-badge role-${currentRole}`}>{currentRole.toUpperCase()}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: '700' }}>➔</span>
                <span className={`profile-role-badge ${badgeClass}`}>{targetRole.toUpperCase()}</span>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>Permission Scope:</strong> {roleDesc}
            </div>
          </div>

          {alertBox}

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => onConfirm(targetRole)}>
              ✓ Confirm &amp; Grant {targetRole.toUpperCase()} Role
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// New Challan Modal Component (Matching Physical Sheet)
// ----------------------------------------------------

function NewChallanModal({ catalog, onClose, onSuccess, apiFetch, showToast }) {
  const { user } = useAuth();
  const [clientName, setClientName] = useState('');
  const [venue, setVenue] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState([
    { srNo: 1, itemName: '', size: '', quantity: 1, remark: '' },
    { srNo: 2, itemName: '', size: '', quantity: 1, remark: '' },
    { srNo: 3, itemName: '', size: '', quantity: 1, remark: '' }
  ]);

  const updateItem = (idx, field, val) => {
    const updated = [...items];
    if (field === 'quantity') {
      updated[idx][field] = Math.max(1, parseInt(val) || 1);
    } else {
      updated[idx][field] = val;
    }

    if (field === 'itemName') {
      const match = catalog.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
      if (match && match.sizes && match.sizes.length > 0 && !updated[idx].size) {
        updated[idx].size = match.sizes[0];
      }
    }
    setItems(updated);
  };

  const addRow = () => {
    setItems([...items, { srNo: items.length + 1, itemName: '', size: '', quantity: 1, remark: '' }]);
  };

  const removeRow = (idx) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalCount = items.reduce((acc, it) => acc + (parseInt(it.quantity) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName || !venue) {
      showToast('Client Name and Venue are required');
      return;
    }

    const validItems = items.filter(it => it.itemName.trim() !== '').map((it, i) => ({
      srNo: i + 1,
      itemName: it.itemName.trim(),
      size: it.size.trim(),
      quantity: parseInt(it.quantity) || 1,
      remark: it.remark.trim()
    }));

    if (validItems.length === 0) {
      showToast('Please enter at least one valid material line');
      return;
    }

    try {
      const res = await apiFetch('/challans', {
        method: 'POST',
        body: JSON.stringify({
          clientName,
          venue,
          dispatchDate,
          dueDate: dueDate || dispatchDate,
          items: validItems
        })
      });
      onSuccess(res.challan);
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container large">
        <div className="modal-header">
          <h2>+ New Digital Dispatch Challan (SHUBH SAJAWAT)</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <datalist id="catalogNamesList">
            {catalog.map(c => <option key={c.id} value={c.name}>{c.category}</option>)}
          </datalist>

          <div className="form-grid three-cols">
            <div className="form-group">
              <label className="form-label">Client Name <span className="req">*</span></label>
              <input
                className="form-control"
                placeholder="e.g. Anna Prashan ( Data Houses )"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Venue / Event Location <span className="req">*</span></label>
              <input
                className="form-control"
                placeholder="e.g. Grand Hyatt Lawn"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Loading Operator (Dispatcher)</label>
              <input className="form-control" value={user?.name || ''} readOnly />
            </div>

            <div className="form-group">
              <label className="form-label">Dispatch Date</label>
              <input
                type="date"
                className="form-control"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Due / Expected Return Date</label>
              <input
                type="date"
                className="form-control"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total No. of Items</label>
              <input className="form-control" value={totalCount} readOnly style={{ fontWeight: 700, background: '#f8fafc' }} />
            </div>
          </div>

          <div className="challan-items-section">
            <div className="challan-items-header">
              <span>MATERIAL ITEMS LIST (DIRECT LOADING ENTRY)</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
                + Add Item Line
              </button>
            </div>
            <div className="challan-item-row head">
              <div className="sr">Sr.No</div>
              <div>Item Image / Name</div>
              <div>Size</div>
              <div>Quantity</div>
              <div>Remark</div>
              <div></div>
            </div>

            {items.map((it, idx) => (
              <div className="challan-item-row" key={idx}>
                <div className="sr">{idx + 1}</div>
                <div>
                  <input
                    type="text"
                    list="catalogNamesList"
                    className="form-control"
                    placeholder="Type or select material..."
                    value={it.itemName}
                    onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Size (e.g. 8*4, 1 Ft)"
                    value={it.size}
                    onChange={(e) => updateItem(idx, 'size', e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Remark / placement note"
                    value={it.remark}
                    onChange={(e) => updateItem(idx, 'remark', e.target.value)}
                  />
                </div>
                <div>
                  <button type="button" className="btn-remove-row" onClick={() => removeRow(idx)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Generate &amp; Save Challan</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Official Printable Shubh Sajawat Challan Slip Modal
// ----------------------------------------------------

function ChallanSlipModal({ challan, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-container large">
        <div className="modal-header no-print">
          <h2>Digital Challan Slip — {challan.id}</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Printer size={14} /> Print Challan Slip
            </button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="printable-challan-container">
            <div className="printable-challan">
              <div className="challan-slip-header">
                SHUBH SAJAWAT CHALLAN
              </div>
              <div className="challan-slip-info">
                <div className="challan-slip-info-row">
                  <div className="challan-info-label">Client Name:</div>
                  <div className="challan-info-value">{challan.clientName}</div>
                </div>
                <div className="challan-slip-info-row">
                  <div className="challan-info-label">Venue / Event:</div>
                  <div className="challan-info-value">{challan.venue}</div>
                </div>
                <div className="challan-slip-info-row">
                  <div className="challan-info-label">Dispatch Date:</div>
                  <div className="challan-info-value">{challan.dispatchDate}</div>
                </div>
                <div className="challan-slip-info-row">
                  <div className="challan-info-label">Due / Return Date:</div>
                  <div className="challan-info-value">{challan.dueDate}</div>
                </div>
                <div className="challan-slip-info-row">
                  <div className="challan-info-label">Total No. of items:</div>
                  <div className="challan-info-value"><strong>{challan.totalItemsCount}</strong></div>
                </div>
              </div>

              <table className="challan-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px' }} className="blue-header">Sr.No</th>
                    <th className="blue-header">Item Image / Name</th>
                    <th style={{ width: '110px' }}>Size</th>
                    <th style={{ width: '90px' }}>Quantity</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {(challan.items || []).map((it, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{i + 1}</td>
                      <td><strong>{it.itemName}</strong></td>
                      <td style={{ textAlign: 'center' }}>{it.size || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.quantity} {it.unit || ''}</td>
                      <td>{it.remark || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="challan-slip-footer">
                <div className="signature-box">
                  <div style={{ marginBottom: '30px', color: '#64748b' }}>(Loaded by: {challan.dispatcherName})</div>
                  <div>SHUBH SAJAWAT SIGN:</div>
                </div>
                <div className="signature-box">
                  <div style={{ marginBottom: '30px', color: '#64748b' }}>(Received at site)</div>
                  <div>RECEIVER SIGN:</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer no-print">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print Slip</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Return Modal Component
// ----------------------------------------------------

function ReturnModal({ challan, onClose, onSuccess, apiFetch, showToast }) {
  const [returnRows, setReturnRows] = useState(
    (challan.items || []).map(it => {
      const returned = it.returnedQty || 0;
      const damaged = it.lossOrDamageQty || 0;
      const out = Math.max(0, it.quantity - returned - damaged);
      return {
        srNo: it.srNo,
        itemName: it.itemName,
        size: it.size,
        quantity: it.quantity,
        outstanding: out,
        returnedQty: out,
        damageQty: 0
      };
    }).filter(x => x.outstanding > 0)
  );

  const [notes, setNotes] = useState('');

  const updateRow = (srNo, field, val) => {
    setReturnRows(returnRows.map(r => {
      if (r.srNo === srNo) {
        return { ...r, [field]: Math.max(0, parseInt(val) || 0) };
      }
      return r;
    }));
  };

  const handleSubmit = async () => {
    const payload = returnRows.map(r => ({
      srNo: r.srNo,
      returnedQty: r.returnedQty,
      damageQty: r.damageQty
    })).filter(x => x.returnedQty > 0 || x.damageQty > 0);

    if (payload.length === 0) {
      showToast('Please specify returned or damaged quantities');
      return;
    }

    try {
      await apiFetch(`/challans/${challan.id}/returns`, {
        method: 'POST',
        body: JSON.stringify({ returns: payload, notes })
      });
      onSuccess();
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container large">
        <div className="modal-header">
          <h2>Receive Material Return — {challan.clientName}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '13px' }}>
            Challan <strong>{challan.id}</strong> | Venue: <strong>{challan.venue}</strong>
          </p>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Size</th>
                  <th>Total Sent</th>
                  <th>Currently Out</th>
                  <th style={{ width: '130px' }}>Return Qty</th>
                  <th style={{ width: '110px' }}>Damaged / Lost</th>
                </tr>
              </thead>
              <tbody>
                {returnRows.map(r => (
                  <tr key={r.srNo}>
                    <td><strong>{r.itemName}</strong></td>
                    <td>{r.size || '—'}</td>
                    <td>{r.quantity}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{r.outstanding}</strong></td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={r.outstanding}
                        className="form-control"
                        value={r.returnedQty}
                        onChange={(e) => updateRow(r.srNo, 'returnedQty', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={r.outstanding}
                        className="form-control"
                        value={r.damageQty}
                        onChange={(e) => updateRow(r.srNo, 'damageQty', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-group full" style={{ marginTop: '16px' }}>
            <label className="form-label">Return Note / Condition Remarks</label>
            <textarea
              className="form-control"
              style={{ minHeight: '70px' }}
              placeholder="e.g. All chairs received in good condition, 1 stand bent."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Confirm &amp; Receive to Warehouse</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Master Catalog Modal Components
// ----------------------------------------------------

function NewMaterialModal({ onClose, onSuccess, apiFetch, showToast }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Furniture');
  const [totalStock, setTotalStock] = useState(10);
  const [sizes, setSizes] = useState('Standard');

  const handleSubmit = async () => {
    if (!name) {
      showToast('Material name is required');
      return;
    }
    try {
      await apiFetch('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          totalStock: parseInt(totalStock) || 0,
          sizes: sizes.split(',').map(s => s.trim()).filter(Boolean)
        })
      });
      onSuccess();
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <h2>+ Add New Material to Catalog</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Material Name <span className="req">*</span></label>
              <input className="form-control" placeholder="e.g. Maharaja Sofa" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Furniture">Furniture</option>
                <option value="Structures">Structures &amp; Frames</option>
                <option value="Artifacts">Artifacts &amp; Props</option>
                <option value="Brass & Metal">Brass &amp; Metal</option>
                <option value="Fabrics">Fabrics &amp; Drapes</option>
                <option value="Lighting">Lighting &amp; Electricals</option>
                <option value="Consumables">Consumables</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Initial Warehouse Stock</label>
              <input type="number" min="0" className="form-control" value={totalStock} onChange={(e) => setTotalStock(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Size Variations (comma-separated)</label>
              <input className="form-control" placeholder="e.g. Standard, 8*4, 1 Ft" value={sizes} onChange={(e) => setSizes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Add to Catalog</button>
        </div>
      </div>
    </div>
  );
}

function EditMaterialModal({ item, onClose, onSuccess, apiFetch, showToast }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [totalStock, setTotalStock] = useState(item.totalStock);
  const [sizes, setSizes] = useState((item.sizes || []).join(', '));

  const handleSubmit = async () => {
    if (!name) {
      showToast('Material name is required');
      return;
    }
    try {
      await apiFetch(`/inventory/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          category,
          totalStock: parseInt(totalStock) || 0,
          sizes: sizes.split(',').map(s => s.trim()).filter(Boolean)
        })
      });
      onSuccess();
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <h2>Edit Material Stock — {item.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Material Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Total Warehouse Stock Units</label>
              <input type="number" min="0" className="form-control" value={totalStock} onChange={(e) => setTotalStock(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Size Variations (comma-separated)</label>
              <input className="form-control" value={sizes} onChange={(e) => setSizes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Authentication Screen (Login / Register)
// ----------------------------------------------------

function AuthScreen() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot'

  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  // Forgot Password state
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(null);

  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await login(loginId, loginPass);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await register(regName, regPhone, regEmail, regPass);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setForgotSuccess(null);

    if (forgotNewPass !== forgotConfirmPass) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: forgotPhone, newPassword: forgotNewPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');

      setForgotSuccess(data.message || 'Password reset successfully!');
      setTimeout(() => {
        setLoginId(forgotPhone);
        setTab('login');
        setForgotSuccess(null);
        setErrorMsg(null);
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">SS</div>
          <h2>SHUBH SAJAWAT</h2>
          <p>MERN Inventory Management &amp; Digital Challan System</p>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setErrorMsg(null); setForgotSuccess(null); }}>
            Sign In
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setErrorMsg(null); setForgotSuccess(null); }}>
            Register Account
          </button>
          {tab === 'forgot' && (
            <button className="auth-tab active">
              Reset Password
            </button>
          )}
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 16px', fontSize: '13px', borderBottom: '1px solid #fca5a5' }}>
            {errorMsg}
          </div>
        )}

        {forgotSuccess && (
          <div style={{ background: '#f0fdf4', color: '#166534', padding: '10px 16px', fontSize: '13px', borderBottom: '1px solid #bbf7d0' }}>
            ✓ {forgotSuccess}
          </div>
        )}

        {tab === 'login' && (
          <div className="auth-body">
            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Username, Mobile Number, or Email</label>
                <input
                  className="form-control"
                  placeholder="Username, mobile number, or email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  required
                />
              </div>

              <div style={{ textAlign: 'right', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setTab('forgot'); setErrorMsg(null); }}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '12.5px', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '500' }}
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In to Dashboard'}
              </button>
            </form>
          </div>
        )}

        {tab === 'register' && (
          <div className="auth-body">
            <div className="auth-notice">
              🔒 <strong>Default Viewer Access:</strong> All newly registered accounts are created with read-only <strong>Viewer</strong> access. An administrator can grant you <strong>Loader</strong> or <strong>Admin</strong> privileges.
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Username <span className="req">*</span></label>
                <input
                  className="form-control"
                  placeholder="Choose a username"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Mobile Number <span className="req">*</span></label>
                <input
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Password <span className="req">*</span></label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Creating...' : 'Create Account (View Only)'}
              </button>
            </form>
          </div>
        )}

        {tab === 'forgot' && (
          <div className="auth-body">
            <div className="auth-notice" style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}>
              🔑 <strong>Password Reset:</strong> Enter your registered mobile number to set a new password.
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Registered Mobile Number <span className="req">*</span></label>
                <input
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">New Password <span className="req">*</span></label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={forgotNewPass}
                  onChange={(e) => setForgotNewPass(e.target.value)}
                  required
                  minLength={4}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Confirm New Password <span className="req">*</span></label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={forgotConfirmPass}
                  onChange={(e) => setForgotConfirmPass(e.target.value)}
                  required
                  minLength={4}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '10px' }} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset & Save Password'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => { setTab('login'); setErrorMsg(null); }}
              >
                ← Back to Sign In
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// App Entrypoint
// ----------------------------------------------------

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a', color: '#ffffff' }}>
        <h2>Loading Shubh Sajawat Portal...</h2>
      </div>
    );
  }

  return user ? <MainApp /> : <AuthScreen />;
}
