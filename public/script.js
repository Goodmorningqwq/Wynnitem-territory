/* ============================================================
   1v1 Wynncraft Eco War — script.js
   ============================================================ */
(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────────
  const STATIC_TERRITORIES_URL = 'https://raw.githubusercontent.com/jakematt123/Wynncraft-Territory-Info/main/territories.json';
  const MAP_IMAGE_URL   = './main-map.webp';
  const MAP_X_MIN = -2500, MAP_X_MAX = 2500;
  const MAP_Z_MIN = -6635, MAP_Z_MAX = 0;
  const MAP_OFFSET_X_PX = 75, MAP_OFFSET_Y_PX = -15;
  const MAP_SCALE_X = 1, MAP_SCALE_Y = 1;
  const FLIP_Z = true;
  const SOCKET_DEV_PORT = 3001;
  const SESSION_KEY_PREFIX = 'ecoWarRoomSessionV2';

  // Real Wynncraft upgrade costs (identical for all 4 stat types)
  const UPGRADE_COSTS_PER_LEVEL = [0, 100, 300, 600, 1200, 2400, 4800, 8400, 12000, 15600, 19200, 22800];
  const UPGRADE_RESOURCE = { damage: 'ore', attackSpeed: 'crops', health: 'wood', defense: 'fish', storage: 'wood' };
  const UPGRADE_ICON     = { damage: '⚔', attackSpeed: '⚡', health: '❤', defense: '🛡', storage: '📦' };
  const UPGRADE_LABEL    = { damage: 'Damage', attackSpeed: 'Atk Speed', health: 'Health', defense: 'Defense', storage: 'Storage' };

  const BONUS_DEFS = {
    strongerMobs:       { icon: '💀', label: 'Stronger Mobs',    desc: 'Mob damage bonus',           resource: 'wood',     costs: [0,1200,2400,4800], maxLevel: 3 },
    multiAttack:        { icon: '⚔⚔',label: 'Multi-Attack',      desc: 'Tower hits 2 targets',        resource: 'fish',     costs: [0,3200],           maxLevel: 1 },
    aura:               { icon: '🔥', label: 'Aura',              desc: 'True dmg — inner circle',     resource: 'crops',    costs: [0,2000],           maxLevel: 1 },
    volley:             { icon: '💥', label: 'Volley',            desc: 'True dmg — outer circle',     resource: 'ore',      costs: [0,2000],           maxLevel: 1 },
    resourceProduction: { icon: '📈', label: 'Res. Production',   desc: '+10% resources per level',    resource: 'ore',      costs: [0,800,1600,3200],  maxLevel: 3 },
    emeraldProduction:  { icon: '💎', label: 'Em. Production',    desc: '+10% emeralds per level',     resource: 'emeralds', costs: [0,1000,2000,4000], maxLevel: 3 }
  };

  const WAR_TYPES = {
    solo:   { label: 'Solo Warrer',      dps: 150000,   icon: '⚔',     color: '#ffcc44' },
    normal: { label: 'Normal War Team',  dps: 2000000,  icon: '⚔⚔',   color: '#ff8844' },
    elite:  { label: 'Elite War Team',   dps: 4000000,  icon: '⚔⚔⚔',  color: '#ff4444' }
  };

  const HQ_BASE_STORE  = { emeralds: 5000,   resource: 1500   };
  const HQ_MAX_STORE   = { emeralds: 400000, resource: 120000 };

  // ─── State ──────────────────────────────────────────────────────────────────
  const state = {
    map: null, geo: null,
    territoryByName: new Map(),
    layerByName: new Map(),
    routeLayer: null,
    hqMarker: null,
    selectedSet: new Set(),
    socket: null,
    currentRoom: null,
    role: null,
    connected: false,
    sfxEnabled: true,
    socketBase: '',
    resumeInFlight: false,
    tickCdTimer: null,
    warCdTimer: null,
    activeMenu: null,   // territory name currently open
    activeTab: 'upgrades',
    warEstimates: null,
    selectedWarType: 'normal',
  };

  // ─── Element refs ────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const E = {
    createBtn:      $('createGameBtn'),
    joinInput:      $('joinCodeInput'),
    joinBtn:        $('joinGameBtn'),
    sfxBtn:         $('sfxToggleBtn'),
    statusText:     $('statusText'),
    sidebar:        $('sidebar'),
    roomCode:       $('roomCodeText'),
    copyCode:       $('copyCodeBtn'),
    statusBadge:    $('statusBadge'),
    roleText:       $('roleText'),
    prepCd:         $('prepCountdownText'),
    readySection:   $('readySection'),
    readyStateText: $('readyStateText'),
    readyBtn:       $('readyBtn'),
    resPanel:       $('resourcesPanel'),
    resEm:          $('resEmeralds'),
    resWo:          $('resWood'),
    resOr:          $('resOre'),
    resCr:          $('resCrops'),
    resFi:          $('resFish'),
    tickCd:         $('tickCountdownText'),
    tickMsgs:       $('tickMessages'),
    towerPanel:     $('towerStatsPanel'),
    towerHP:        $('towerHP'),
    towerEHP:       $('towerEHP'),
    towerConn:      $('towerConn'),
    towerHLv:       $('towerHLv'),
    towerDLv:       $('towerDLv'),
    selCount:       $('selCount'),
    terrList:       $('territoryList'),
    clickHint:      $('clickHint'),
    openManageBtn:  $('openManageBtn'),
    // Menu
    tMenuOverlay:   $('tMenuOverlay'),
    tMenuBox:       $('tMenuBox'),
    tMenuTitle:     $('tMenuTitle'),
    tMenuSelect:    $('tMenuSelect'),
    tMenuCloseBtn:  $('tMenuCloseBtn'),
    tMenuBody:      $('tMenuBody'),
    // War
    warPanel:       $('warPanel'),
    warTypeCards:   $('warTypeCards'),
    warCdBar:       $('warCountdownBar'),
    warCdText:      $('warCountdownText'),
    warResultOver:  $('warResultOverlay'),
    warResultHdr:   $('warResultHdr'),
    warResultStats: $('warResultStats'),
    warResultClose: $('warResultCloseBtn'),
  };

  // ─── Utilities ───────────────────────────────────────────────────────────────
  const fmt = v => (Number(v) || 0).toLocaleString();
  const fmtTime = s => (Math.floor(s / 60)) + 'm ' + String(Math.max(0, s % 60)).padStart(2, '0') + 's';
  const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clamp01 = v => clamp(v, 0, 1);

  function playSfx(type) {
    if (!state.sfxEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = type === 'success' ? 880 : type === 'warn' ? 330 : 660;
      gn.gain.setValueAtTime(0.0001, ctx.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gn); gn.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.16);
      osc.onended = () => ctx.close();
    } catch (_) {}
  }

  // ─── Session ─────────────────────────────────────────────────────────────────
  const sessionKey = () => SESSION_KEY_PREFIX + ':' + (state.socketBase || 'default');
  function saveSession(s) { try { sessionStorage.setItem(sessionKey(), JSON.stringify(s)); } catch(_) {} }
  function loadSession() {
    try {
      const raw = sessionStorage.getItem(sessionKey());
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !/^\d{6}$/.test(p.roomId || '') || !p.playerToken || (p.role !== 'defender' && p.role !== 'attacker')) return null;
      return p;
    } catch(_) { return null; }
  }
  function clearSession() { try { sessionStorage.removeItem(sessionKey()); } catch(_) {} }

  // ─── Socket URL / Token ──────────────────────────────────────────────────────
  function getSocketBase() {
    try {
      const el = document.querySelector('meta[name="eco-war-socket-url"]');
      if (el && el.content.trim()) return el.content.trim().replace(/\/+$/, '');
    } catch(_) {}
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') return 'http://127.0.0.1:' + SOCKET_DEV_PORT;
    return null;
  }
  function getSharedToken() {
    try {
      const el = document.querySelector('meta[name="eco-war-shared-token"]');
      if (el && el.content.trim()) return el.content.trim();
    } catch(_) {}
    return '';
  }

  // ─── Map Coordinate Helpers ──────────────────────────────────────────────────
  function worldToLayer(x, z) {
    const { imgW, imgH } = state.geo;
    let nx = x < 0 ? 0.5 - 0.5 * (Math.abs(x) / Math.abs(MAP_X_MIN)) : 0.5 + 0.5 * (Math.abs(x) / Math.abs(MAP_X_MAX));
    let ny = z <= 0 ? 1 - (Math.abs(z) / Math.abs(MAP_Z_MIN)) : 1 + (Math.abs(z) / Math.abs(MAP_Z_MAX));
    nx = clamp01(nx); ny = clamp01(ny);
    if (FLIP_Z) ny = 1 - ny;
    const snx = 0.5 + (nx - 0.5) * MAP_SCALE_X;
    const sny = 0.5 + (ny - 0.5) * MAP_SCALE_Y;
    return L.latLng(sny * imgH + MAP_OFFSET_Y_PX, snx * imgW + MAP_OFFSET_X_PX);
  }
  function boundsFromWorldRect(t) {
    const corners = [
      worldToLayer(t.minX, t.minZ), worldToLayer(t.maxX, t.minZ),
      worldToLayer(t.maxX, t.maxZ), worldToLayer(t.minX, t.maxZ),
    ];
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    corners.forEach(c => {
      if (c.lat < minLat) minLat = c.lat; if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng; if (c.lng > maxLng) maxLng = c.lng;
    });
    return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
  }
  function territoryCenterLatLng(name) {
    const t = state.territoryByName.get(name);
    if (!t) return null;
    return worldToLayer((t.minX + t.maxX) / 2, (t.minZ + t.maxZ) / 2);
  }

  // ─── HQ Capacity ─────────────────────────────────────────────────────────────
  function hqCap(storLevel, resKey) {
    const lv = clamp(storLevel, 0, 11);
    if (resKey === 'emeralds') return Math.floor(HQ_BASE_STORE.emeralds + (lv / 11) * (HQ_MAX_STORE.emeralds - HQ_BASE_STORE.emeralds));
    return Math.floor(HQ_BASE_STORE.resource + (lv / 11) * (HQ_MAX_STORE.resource - HQ_BASE_STORE.resource));
  }

  // ─── Territory Styling ───────────────────────────────────────────────────────
  function styleFor(name) {
    const room = state.currentRoom;
    const hq   = room && room.hqTerritory ? room.hqTerritory : '';
    const sel  = state.selectedSet.has(name) || (room && (room.selectedTerritories || []).includes(name));
    const isHq = !!hq && name === hq;
    if (sel && isHq) return { color: '#facc15', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.55, opacity: 1 };
    if (sel)         return { color: '#4da3ff', weight: 2, fillColor: '#3b82f6', fillOpacity: 0.45, opacity: 1 };
    if (isHq)        return { color: '#facc15', weight: 2, fillColor: '#fde68a', fillOpacity: 0.3,  opacity: 0.9 };
    return { color: 'rgba(180,180,200,0.7)', weight: 1, fillColor: '#ffffff', fillOpacity: 0.15, opacity: 0.75 };
  }
  function updateStyle(name) { const l = state.layerByName.get(name); if (l) l.setStyle(styleFor(name)); }
  function updateAllStyles() { state.layerByName.forEach((_, n) => updateStyle(n)); }

  // ─── Route Rendering ─────────────────────────────────────────────────────────
  function buildAdjacency(selectedArr) {
    const set = new Set(selectedArr);
    const adj = new Map();
    selectedArr.forEach(n => adj.set(n, new Set()));
    selectedArr.forEach(from => {
      const t = state.territoryByName.get(from);
      if (!t || !t.tradeRoutes) return;
      t.tradeRoutes.forEach(to => {
        if (!set.has(to)) return;
        adj.get(from).add(to);
        adj.get(to).add(from);
      });
    });
    return adj;
  }
  function bfsHq(from, hq, adj) {
    if (from === hq) return [hq];
    if (!adj.has(from) || !adj.has(hq)) return null;
    const queue = [from], visited = new Set([from]), parent = new Map();
    while (queue.length) {
      const cur = queue.shift();
      for (const next of Array.from(adj.get(cur) || [])) {
        if (visited.has(next)) continue;
        visited.add(next); parent.set(next, cur);
        if (next === hq) {
          const path = [hq]; let c = hq;
          while (parent.has(c)) { c = parent.get(c); path.push(c); if (c === from) break; }
          return path.reverse();
        }
        queue.push(next);
      }
    }
    return null;
  }
  function renderRoutes() {
    if (!state.routeLayer) return;
    state.routeLayer.clearLayers();
    if (state.hqMarker) { state.map.removeLayer(state.hqMarker); state.hqMarker = null; }
    const room = state.currentRoom;
    const selected = room ? (room.selectedTerritories || []) : Array.from(state.selectedSet);
    const hq = room ? (room.hqTerritory || selected[0]) : selected[0];
    if (!selected.length || !hq) return;
    const selectedSet = new Set(selected);
    const adj = buildAdjacency(selected);
    // Compute path edges
    const pathEdges = new Set();
    selected.forEach(name => {
      const path = bfsHq(name, hq, adj);
      if (!path || path.length < 2) return;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        if (selectedSet.has(a) && selectedSet.has(b)) pathEdges.add(a < b ? a + '|' + b : b + '|' + a);
      }
    });
    // Draw edges
    const drawn = new Set();
    selected.forEach(name => {
      const t = state.territoryByName.get(name);
      if (!t || !t.tradeRoutes) return;
      t.tradeRoutes.forEach(other => {
        if (!selectedSet.has(other)) return;
        const key = name < other ? name + '|' + other : other + '|' + name;
        if (drawn.has(key)) return;
        drawn.add(key);
        const s = territoryCenterLatLng(name), e = territoryCenterLatLng(other);
        if (!s || !e) return;
        const onPath = pathEdges.has(key);
        L.polyline([s, e], {
          color: onPath ? '#ffe08a' : '#8ec5ff',
          weight: onPath ? 3 : 2,
          opacity: onPath ? 0.95 : 0.5,
          dashArray: onPath ? null : '5 5'
        }).addTo(state.routeLayer);
      });
    });
    // HQ crown marker
    const ctr = territoryCenterLatLng(hq);
    if (ctr) {
      const icon = L.divIcon({ className: '', html: '<div style="font-size:18px;text-shadow:0 1px 4px #000;line-height:1;">👑</div>', iconSize: [20, 20], iconAnchor: [10, 10] });
      state.hqMarker = L.marker(ctr, { icon, interactive: false }).addTo(state.map);
    }
  }

  // ─── Territory Click ─────────────────────────────────────────────────────────
  function onTerritoryClick(name) {
    const room = state.currentRoom;
    const status = room ? room.status : 'lobby';
    if (status === 'prep' || status === 'playing') {
      openMenu(name); return;
    }
    // Lobby — toggle for defender
    if (state.role === 'attacker') { openMenu(name); return; }
    if (state.selectedSet.has(name)) {
      state.selectedSet.delete(name);
    } else {
      state.selectedSet.add(name);
    }
    updateAllStyles();
    renderRoutes();
    renderSidebar();
    socketCtrl.syncSelection();
  }

  // ─── Map Initialisation ───────────────────────────────────────────────────────
  function readTradeRoutes(row) {
    const tr = row['Trading Routes'] || row.tradingRoutes || row.trade_routes;
    return Array.isArray(tr) ? tr.map(String) : [];
  }

  function initMapLayers(territories) {
    territories.forEach(t => {
      state.territoryByName.set(t.name, t);
      const layer = L.rectangle(boundsFromWorldRect(t), styleFor(t.name));
      layer.on('click', () => onTerritoryClick(t.name));
      layer.bindTooltip(t.name, { sticky: true, direction: 'auto', className: 'terr-tooltip' });
      layer.addTo(state.map);
      state.layerByName.set(t.name, layer);
    });
  }

  async function initMap() {
    const img = new Image();
    img.src = MAP_IMAGE_URL;
    await new Promise(res => { img.onload = res; img.onerror = res; });
    const imgW = img.naturalWidth  || 1024;
    const imgH = img.naturalHeight || 1024;
    state.geo = { imgW, imgH };

    state.map = L.map(document.getElementById('map'), {
      crs: L.CRS.Simple, minZoom: -4, maxZoom: 2,
      zoomControl: true, attributionControl: false
    });
    const bounds = L.latLngBounds([[0, 0], [imgH, imgW]]);
    L.imageOverlay(MAP_IMAGE_URL, bounds).addTo(state.map);
    state.map.fitBounds(bounds);
    state.routeLayer = L.layerGroup().addTo(state.map);

    try {
      const res  = await fetch(STATIC_TERRITORIES_URL);
      const data = await res.json();
      const territories = [];
      Object.keys(data).forEach(name => {
        const row = data[name] || {};
        const loc = row.Location || row.location;
        if (!loc || !loc.start || !loc.end) return;
        territories.push({
          name,
          minX: Math.min(loc.start[0], loc.end[0]),
          maxX: Math.max(loc.start[0], loc.end[0]),
          minZ: Math.min(loc.start[1], loc.end[1]),
          maxZ: Math.max(loc.start[1], loc.end[1]),
          tradeRoutes: readTradeRoutes(row),
          resources: {
            emeralds: parseInt((row.resources || {}).emeralds || 0, 10) || 0,
            wood:     parseInt((row.resources || {}).wood     || 0, 10) || 0,
            ore:      parseInt((row.resources || {}).ore      || 0, 10) || 0,
            crops:    parseInt((row.resources || {}).crops    || 0, 10) || 0,
            fish:     parseInt((row.resources || {}).fish     || 0, 10) || 0,
          }
        });
      });
      initMapLayers(territories);
    } catch (e) {
      console.error('Territory data load failed', e);
    }
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────────
  function renderSidebar() {
    const room = state.currentRoom;
    if (!room) { E.sidebar.style.display = 'none'; return; }
    E.sidebar.style.display = 'flex';

    E.roomCode.textContent = room.id || '------';
    E.roleText.textContent = state.role ? state.role.toUpperCase() : '';

    const status = room.status || 'lobby';
    E.statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    E.statusBadge.className = 'status-badge' + (status === 'prep' ? ' prep' : status === 'playing' ? ' playing' : '');

    // Prep countdown
    if (status === 'prep' && typeof room.prepSecondsRemaining === 'number' && room.prepSecondsRemaining !== null) {
      E.prepCd.style.display = 'block';
      E.prepCd.textContent = '⏱ Prep ends in: ' + room.prepSecondsRemaining + 's';
    } else {
      E.prepCd.style.display = 'none';
    }

    // Ready section
    E.readySection.style.display = status === 'lobby' ? 'block' : 'none';
    E.readyStateText.textContent = 'Defender: ' + (room.defenderReady ? '✅' : '❌') + '  |  Attacker: ' + (room.attackerReady ? '✅' : '❌');
    const canReady = status === 'lobby' && !!state.role && !!room.defenderSocketId && !!room.attackerSocketId;
    E.readyBtn.disabled = !canReady;
    const myReady = state.role === 'defender' ? room.defenderReady : room.attackerReady;
    E.readyBtn.textContent = myReady ? '✅ UNREADY' : 'READY';

    // Resources panel
    const showRes = status === 'prep' || status === 'playing';
    E.resPanel.style.display = showRes ? 'block' : 'none';

    // Tower stats (attacker view)
    const showTower = showRes && state.role === 'attacker';
    E.towerPanel.style.display = showTower ? 'block' : 'none';
    if (showTower && state.warEstimates && state.warEstimates.towerStats) {
      const ts = state.warEstimates.towerStats;
      E.towerHP.textContent   = fmt(ts.towerHP);
      E.towerEHP.textContent  = fmt(ts.effectiveHP);
      E.towerConn.textContent = ts.connections;
      E.towerHLv.textContent  = ts.healthLevel;
      E.towerDLv.textContent  = ts.defenseLevel;
    }

    // Territory list
    const selected = room.selectedTerritories || Array.from(state.selectedSet);
    E.selCount.textContent = selected.length;
    E.terrList.innerHTML = selected.slice(0, 50).map(name => {
      const isHq = name === room.hqTerritory;
      const upgrades = room.territoryUpgrades && room.territoryUpgrades[name];
      let badge = '';
      if (upgrades) {
        const parts = [];
        if (upgrades.damage)      parts.push('D' + upgrades.damage);
        if (upgrades.attackSpeed) parts.push('A' + upgrades.attackSpeed);
        if (upgrades.health)      parts.push('H' + upgrades.health);
        if (upgrades.defense)     parts.push('DEF' + upgrades.defense);
        if (parts.length) badge = `<span class="terr-badge">${parts.join(' ')}</span>`;
      }
      return `<div class="terr-item">${isHq ? '👑 ' : ''}<span style="flex:1;">${name}</span>${badge}</div>`;
    }).join('');

    // Click hint
    if (status === 'lobby' && state.role === 'defender') {
      E.clickHint.textContent = 'Click territories to select/deselect';
    } else if (status === 'prep' || status === 'playing') {
      E.clickHint.textContent = 'Click territory on map to manage';
    } else {
      E.clickHint.textContent = '';
    }
    E.openManageBtn.style.display = (showRes && selected.length) ? 'block' : 'none';

    // Attacker war panel
    const showWarPanel = status === 'prep' && state.role === 'attacker';
    E.warPanel.style.display = showWarPanel ? 'flex' : 'none';
    if (showWarPanel) renderWarPanel();

    // War countdown
    if (status === 'playing' && room.warStartedAt && room.warTimeSeconds) {
      startWarCountdown(room.warStartedAt, room.warTimeSeconds);
    }
  }

  // ─── War Panel ───────────────────────────────────────────────────────────────
  function renderWarPanel() {
    const estimates = state.warEstimates && state.warEstimates.estimates;
    let html = '';
    Object.entries(WAR_TYPES).forEach(([type, def]) => {
      const est = estimates && estimates[type];
      const secs = est ? est.warTimeSeconds : null;
      const timeStr = secs != null ? fmtTime(secs) : '—';
      const tcls = secs == null ? '' : secs < 60 ? 'fast' : secs < 300 ? 'mid' : 'slow';
      const sel = state.selectedWarType === type;
      html += `<div class="war-type-card${sel ? ' sel' : ''}" data-type="${type}">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:16px;">${def.icon}</span>
          <span class="wt-name" style="color:${def.color};">${def.label}</span>
        </div>
        <div class="wt-dps">${fmt(def.dps)} DPS</div>
        <div class="wt-time ${tcls}">⏱ ${timeStr}</div>
      </div>`;
    });
    E.warTypeCards.innerHTML = html;
    E.warTypeCards.querySelectorAll('.war-type-card').forEach(card => {
      card.addEventListener('click', function () {
        state.selectedWarType = this.dataset.type;
        renderWarPanel();
        socketCtrl.selectWarType(this.dataset.type);
      });
    });
  }

  // ─── War Countdown ────────────────────────────────────────────────────────────
  function startWarCountdown(startedAt, totalSecs) {
    if (state.warCdTimer) clearInterval(state.warCdTimer);
    E.warCdBar.style.display = 'block';
    function paint() {
      const rem = Math.max(0, Math.ceil(totalSecs - (Date.now() - startedAt) / 1000));
      E.warCdText.textContent = fmtTime(rem);
      if (rem <= 0) { clearInterval(state.warCdTimer); state.warCdTimer = null; }
    }
    paint();
    state.warCdTimer = setInterval(paint, 500);
  }

  // ─── War Result ───────────────────────────────────────────────────────────────
  function showWarResult(result, stats) {
    const atkWins = result === 'attacker_wins';
    E.warResultHdr.className = 'war-result-hdr ' + (atkWins ? 'atk' : 'def');
    E.warResultHdr.textContent = atkWins ? '⚔ TERRITORY CAPTURED!' : '🛡 DEFENSE HELD!';
    if (stats) {
      const wtn = WAR_TYPES[stats.attackerWarType];
      E.warResultStats.innerHTML = [
        ['HQ Territory', stats.hq || '—'],
        ['Tower HP',     fmt(stats.towerHP)],
        ['Effective HP', fmt(stats.effectiveHP)],
        ['Connections',  `+${Math.round((1 + 0.3 * (stats.connections || 0)) * 100 - 100)}% bonus`],
        ['Attacker',     wtn ? wtn.label : '—'],
        ['Attacker DPS', fmt(stats.attackerDPS)],
        ['War Duration', fmtTime(stats.warTimeSeconds || 0)],
      ].map(([k, v]) => `<div class="wr-stat"><span class="wr-key">${k}</span><span class="wr-val">${v}</span></div>`).join('');
    }
    E.warResultOver.style.display = 'flex';
  }

  // ─── Tick Countdown ────────────────────────────────────────────────────────────
  function startTickCd(nextMs) {
    if (state.tickCdTimer) clearInterval(state.tickCdTimer);
    const endsAt = Date.now() + (nextMs || 0);
    function paint() {
      const rem = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      E.tickCd.textContent = '⏱ Next tick in: ' + rem + 's';
      if (rem === 0) { clearInterval(state.tickCdTimer); state.tickCdTimer = null; }
    }
    paint();
    state.tickCdTimer = setInterval(paint, 250);
  }

  // ─── Territory Menu ───────────────────────────────────────────────────────────
  function openMenu(name) {
    state.activeMenu = name;
    const room = state.currentRoom;
    if (!room) return;
    const selected = room.selectedTerritories || [];
    E.tMenuSelect.innerHTML = selected.map(t =>
      `<option value="${t}"${t === name ? ' selected' : ''}>${t}${t === room.hqTerritory ? ' 👑' : ''}</option>`
    ).join('');
    renderMenuContent();
    E.tMenuOverlay.style.display = 'flex';
  }
  function closeMenu() { E.tMenuOverlay.style.display = 'none'; state.activeMenu = null; }
  function refreshMenuIfOpen() {
    if (state.activeMenu && E.tMenuOverlay.style.display !== 'none') renderMenuContent();
  }

  function renderMenuContent() {
    const name = state.activeMenu;
    const room = state.currentRoom;
    if (!name || !room) return;
    E.tMenuTitle.textContent = name + (name === room.hqTerritory ? ' 👑' : '');
    const isDefender   = state.role === 'defender';
    const interactive  = (room.status === 'prep' || room.status === 'playing') && isDefender;
    const tab = state.activeTab;
    if      (tab === 'upgrades') renderTabUpgrades(name, room, interactive);
    else if (tab === 'bonuses')  renderTabBonuses(name, room, interactive);
    else if (tab === 'storage')  renderTabStorage(name, room, interactive);
    else if (tab === 'tax')      renderTabTax(name, room, interactive);
    else if (tab === 'info')     renderTabInfo(name, room);
  }

  /* ── Tab: Upgrades ────────────────────────────────────────────────────────── */
  function renderTabUpgrades(name, room, interactive) {
    const upg = (room.territoryUpgrades && room.territoryUpgrades[name]) || {};
    const cats = ['damage', 'attackSpeed', 'health', 'defense'];

    let html = '<div class="upg-grid">';
    cats.forEach(cat => {
      const lv = parseInt(upg[cat] || 0);
      const maxed = lv >= 11;
      const drain = UPGRADE_COSTS_PER_LEVEL[lv] || 0;
      const nextD = maxed ? 0 : (UPGRADE_COSTS_PER_LEVEL[lv + 1] || 0);
      const bars  = Array.from({length: 11}, (_, i) => `<span class="${i < lv ? 'on' + (maxed ? ' maxed' : '') : ''}"></span>`).join('');
      html += `<div class="upg-card${maxed ? ' maxed' : ''}">
        <div class="upg-hdr">
          <span class="upg-icon">${UPGRADE_ICON[cat]}</span>
          <span class="upg-name">${UPGRADE_LABEL[cat]}</span>
          <span class="upg-res">${UPGRADE_RESOURCE[cat]}</span>
        </div>
        <div class="upg-lv">
          <span class="lv-badge${maxed ? ' maxed' : ''}">Lv${lv}</span>
          <div class="seg-bar" style="flex:1;">${bars}</div>
        </div>
        <div class="upg-cost">Drain: ${drain ? fmt(drain) + ' ' + UPGRADE_RESOURCE[cat] + '/hr' : '—'}</div>
        ${!maxed ? `<div class="upg-cost" style="color:#2a5020;">Next: ${fmt(nextD)}/hr</div>` : '<div class="upg-cost" style="color:#3a7020;">MAX LEVEL ★</div>'}
        ${interactive && !maxed ? `<button class="mc-btn green upg-btn" data-cat="${cat}" style="width:100%;margin-top:4px;font-size:16px;">UPGRADE</button>` : ''}
      </div>`;
    });

    // Storage (full width)
    const sl    = parseInt(upg.storage || 0);
    const smaxed = sl >= 11;
    const sbars = Array.from({length: 11}, (_, i) => `<span class="${i < sl ? 'on' + (smaxed ? ' maxed' : '') : ''}"></span>`).join('');
    const isHq  = name === room.hqTerritory;
    html += `<div class="stor-card">
      <div class="upg-hdr"><span class="upg-icon">📦</span><span class="upg-name">Storage</span></div>
      <div class="upg-lv">
        <span class="lv-badge${smaxed ? ' maxed' : ''}">Lv${sl}/11</span>
        <div class="seg-bar" style="flex:1;">${sbars}</div>
      </div>
      <div class="upg-cost">${isHq
        ? 'HQ cap: ' + fmt(hqCap(sl, 'resource')) + ' resources / ' + fmt(hqCap(sl, 'emeralds')) + ' em'
        : 'Non-HQ: unlimited pass-through storage'}</div>
      ${interactive && !smaxed ? `<button class="mc-btn upg-btn" data-cat="storage" style="width:100%;margin-top:4px;font-size:16px;">UPGRADE STORAGE</button>` : ''}
    </div>`;
    html += '</div>';

    // HQ Selector
    if (interactive) {
      const sel = (room.selectedTerritories || []).map(t =>
        `<option value="${t}"${t === room.hqTerritory ? ' selected' : ''}>${t}</option>`
      ).join('');
      html += `<div class="hq-sel-box">
        <div class="mc-label" style="margin-bottom:6px;">Set Guild HQ Territory</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <select id="hqSelDd" style="flex:1;font-family:VT323,monospace;font-size:16px;background:#2d2418;color:#f0e0a0;border:2px solid #373737;padding:3px 6px;">${sel}</select>
          <button id="setHqBtn" class="mc-btn green" style="font-size:16px;">Set HQ</button>
        </div>
      </div>`;
    }

    E.tMenuBody.innerHTML = html;
    E.tMenuBody.querySelectorAll('.upg-btn').forEach(btn => {
      btn.addEventListener('click', function () { socketCtrl.applyUpgrade(name, this.dataset.cat); });
    });
    if (interactive) {
      const sb = E.tMenuBody.querySelector('#setHqBtn');
      if (sb) sb.addEventListener('click', () => {
        const dd = E.tMenuBody.querySelector('#hqSelDd');
        if (dd) socketCtrl.setHqTerritory(dd.value);
      });
    }
  }

  /* ── Tab: Bonuses ─────────────────────────────────────────────────────────── */
  function renderTabBonuses(name, room, interactive) {
    const bon = (room.territoryBonuses && room.territoryBonuses[name]) || {};
    let html = '';
    const towerBonus = ['strongerMobs', 'multiAttack', 'aura', 'volley'];
    const ecoBonus   = ['resourceProduction', 'emeraldProduction'];

    html += '<div class="bonus-sec-hdr">🏰 Tower Bonuses</div><div class="bonus-list">';
    towerBonus.forEach(key => {
      const def = BONUS_DEFS[key];
      const lv  = parseInt(bon[key] || 0);
      const maxed = lv >= def.maxLevel;
      html += bonusCard(name, key, def, lv, maxed, interactive);
    });
    html += '</div><div class="bonus-divider"></div>';
    html += '<div class="bonus-sec-hdr">📈 Economy Bonuses</div><div class="bonus-list">';
    ecoBonus.forEach(key => {
      const def = BONUS_DEFS[key];
      const lv  = parseInt(bon[key] || 0);
      const maxed = lv >= def.maxLevel;
      html += bonusCard(name, key, def, lv, maxed, interactive);
    });
    html += '</div>';

    E.tMenuBody.innerHTML = html;
    E.tMenuBody.querySelectorAll('.bonus-btn').forEach(btn => {
      btn.addEventListener('click', function () { socketCtrl.applyBonus(name, this.dataset.key); });
    });
  }
  function bonusCard(name, key, def, lv, maxed, interactive) {
    const drain = def.costs[lv] || 0;
    const nextD = maxed ? 0 : (def.costs[lv + 1] || 0);
    return `<div class="bonus-card">
      <div class="bonus-icon-cell">${def.icon}</div>
      <div class="bonus-info">
        <div class="bonus-name">${def.label} <span style="color:#4a7030;font-size:14px;">Lv${lv}/${def.maxLevel}</span></div>
        <div class="bonus-desc">${def.desc}</div>
        <div class="bonus-desc">Resource: ${def.resource} | Drain: ${drain ? fmt(drain) + '/hr' : '—'}</div>
        ${!maxed ? `<div class="bonus-desc" style="color:#2a5020;">Next level: ${fmt(nextD)} ${def.resource}/hr</div>` : '<div class="bonus-desc" style="color:#3a7020;">MAX LEVEL ★</div>'}
      </div>
      ${interactive && !maxed ? `<button class="mc-btn green bonus-btn" data-key="${key}" style="font-size:20px;padding:4px 10px;">+</button>` : ''}
    </div>`;
  }

  /* ── Tab: Storage ─────────────────────────────────────────────────────────── */
  function renderTabStorage(name, room, interactive) {
    const isHq = name === room.hqTerritory;
    const upg   = (room.territoryUpgrades && room.territoryUpgrades[name]) || {};
    const sl    = parseInt(upg.storage || 0);
    const store  = (room.perTerritoryStorage && room.perTerritoryStorage[name]) || {};
    let html = '';

    if (isHq) {
      html += '<div class="mc-label" style="margin-bottom:8px;">📦 HQ Resource Bank</div>';
      const RES = [
        { key:'emeralds', icon:'🟡', label:'Emeralds' },
        { key:'wood',     icon:'🪵', label:'Wood'     },
        { key:'ore',      icon:'⛏',  label:'Ore'      },
        { key:'crops',    icon:'🌾', label:'Crops'    },
        { key:'fish',     icon:'🐟', label:'Fish'     },
      ];
      RES.forEach(r => {
        const val  = store[r.key] || 0;
        const cap  = hqCap(sl, r.key);
        const pct  = Math.min(100, (val / cap) * 100);
        const over = val > cap;
        const fcls = over ? 'danger' : pct > 75 ? 'warn' : '';
        html += `<div class="hq-res-bar">
          <div class="hq-res-lbl">
            <span>${r.icon} ${r.label}</span>
            <span class="${over ? 'over' : ''}">${fmt(val)} / ${fmt(cap)}</span>
          </div>
          <div class="mc-bar-bg"><div class="mc-bar-fill ${fcls}" style="width:${pct}%;"></div></div>
        </div>`;
      });
    } else {
      html += `<div class="passthrough-box">
        📦 Non-HQ Territory<br>Resources pass through freely toward HQ each tick.<br>No local storage cap applied.
      </div>`;
      const transitKeys = Object.keys(store).filter(k => (store[k] || 0) > 0);
      if (transitKeys.length) {
        html += '<div class="mc-label" style="margin-bottom:6px;">In Transit</div>';
        transitKeys.forEach(k => { html += `<div class="mc-small">${k}: ${fmt(store[k])}</div>`; });
      }
    }

    // Storage upgrade button
    const smaxed = sl >= 11;
    html += `<div style="margin-top:10px;"><div class="upg-lv">
      <span class="lv-badge${smaxed ? ' maxed' : ''}">Lv ${sl}/11</span>
      <div class="seg-bar" style="flex:1;">${Array.from({length:11},(_,i)=>`<span class="${i<sl?'on'+(smaxed?' maxed':''):''}"></span>`).join('')}</div>
    </div>`;
    if (interactive && !smaxed && isHq) {
      html += `<button class="mc-btn upg-btn" data-cat="storage" style="width:100%;margin-top:6px;font-size:16px;">UPGRADE STORAGE</button>`;
    } else if (!isHq && interactive) {
      html += `<button id="makeHqBtn" class="mc-btn blue" style="width:100%;margin-top:6px;font-size:18px;">👑 Set as HQ</button>`;
    }
    html += '</div>';

    E.tMenuBody.innerHTML = html;
    const ub = E.tMenuBody.querySelector('.upg-btn');
    if (ub) ub.addEventListener('click', () => socketCtrl.applyUpgrade(name, 'storage'));
    const hqb = E.tMenuBody.querySelector('#makeHqBtn');
    if (hqb) hqb.addEventListener('click', () => socketCtrl.setHqTerritory(name));
  }

  /* ── Tab: Tax & Route ─────────────────────────────────────────────────────── */
  function renderTabTax(name, room, interactive) {
    const tax     = (room.territoryTaxRates && room.territoryTaxRates[name]) || { enemy: 0.30, ally: 0.10 };
    const routeM  = (room.territoryRouteMode && room.territoryRouteMode[name]) || 'fastest';
    const hq      = room.hqTerritory || '';
    const selected = room.selectedTerritories || [];
    const adj     = buildAdjacency(selected);
    const path    = bfsHq(name, hq, adj);
    const pathStr = path ? path.join(' → ') : 'No route to HQ';
    const hops    = path ? path.length - 1 : '?';

    let html = `<div class="mc-label" style="margin-bottom:6px;">Routing Mode</div>
    <div class="route-toggle">
      <button class="mc-btn${routeM === 'fastest' ? ' green' : ''} route-btn" data-mode="fastest" style="flex:1;">⚡ Fastest</button>
      <button class="mc-btn${routeM === 'cheapest' ? ' green' : ''} route-btn" data-mode="cheapest" style="flex:1;">💰 Cheapest</button>
    </div>
    <div class="route-preview">
      <span class="mc-small">Route to HQ:</span><br>
      ${path ? path.join(' → ') : '<span style="color:#cc3333;">No route found</span>'}
      ${path ? `<br><span class="mc-small">Hops: ${hops}</span>` : ''}
    </div>
    <div style="margin-top:12px;">
      <div class="mc-label" style="margin-bottom:8px;">Tax Rates (informational display)</div>
      <div class="tax-row">
        <div class="tax-lbl">Enemy Tax: <span id="eTaxLbl">${Math.round(tax.enemy * 100)}%</span></div>
        <input type="range" class="tax-slider" id="eTaxSlider" min="5" max="40" value="${Math.round(tax.enemy * 100)}" ${!interactive ? 'disabled' : ''}>
      </div>
      <div class="tax-row">
        <div class="tax-lbl">Ally Tax: <span id="aTaxLbl">${Math.round(tax.ally * 100)}%</span></div>
        <input type="range" class="tax-slider" id="aTaxSlider" min="5" max="40" value="${Math.round(tax.ally * 100)}" ${!interactive ? 'disabled' : ''}>
      </div>
      ${interactive ? '<button id="saveTaxBtn" class="mc-btn green" style="width:100%;font-size:16px;margin-top:6px;">💾 Save Tax Rates</button>' : ''}
    </div>`;

    E.tMenuBody.innerHTML = html;

    E.tMenuBody.querySelectorAll('.route-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (interactive) socketCtrl.setRouteMode(name, this.dataset.mode);
      });
    });
    const es = E.tMenuBody.querySelector('#eTaxSlider');
    const as = E.tMenuBody.querySelector('#aTaxSlider');
    const el = E.tMenuBody.querySelector('#eTaxLbl');
    const al = E.tMenuBody.querySelector('#aTaxLbl');
    if (es) es.addEventListener('input', function () { el.textContent = this.value + '%'; });
    if (as) as.addEventListener('input', function () { al.textContent = this.value + '%'; });
    const sb = E.tMenuBody.querySelector('#saveTaxBtn');
    if (sb) sb.addEventListener('click', () => socketCtrl.setTaxRate(name, parseFloat(es.value) / 100, parseFloat(as.value) / 100));
  }

  /* ── Tab: Info ────────────────────────────────────────────────────────────── */
  function renderTabInfo(name, room) {
    const t     = state.territoryByName.get(name);
    const isHq  = name === room.hqTerritory;
    const upg   = (room.territoryUpgrades  && room.territoryUpgrades[name])  || {};
    const bon   = (room.territoryBonuses   && room.territoryBonuses[name])   || {};
    const held  = room.territoryHeldSince  && room.territoryHeldSince[name];
    const sel   = room.selectedTerritories || [];
    const selSt = new Set(sel);
    const routes = t ? t.tradeRoutes : [];
    const conns = routes.filter(r => r !== name && selSt.has(r)).length;
    const connMult = (1 + 0.3 * conns).toFixed(1);

    let treaPct = 0;
    if (held) treaPct = Math.min(100, Math.floor((Date.now() - held) / 3600000) * 5);

    const resProdLv = bon.resourceProduction || 0;
    const emProdLv  = bon.emeraldProduction  || 0;
    const resMult   = 1 + (treaPct / 100) + (resProdLv * 0.10);
    const emMult    = 1 + (treaPct / 100) + (emProdLv  * 0.10);

    const RES_ICONS = { emeralds: '🟡', wood: '🪵', ore: '⛏', crops: '🌾', fish: '🐟' };

    let html = `
      <div class="info-row"><span class="info-key">📍 Territory</span><span class="info-val">${name}</span></div>
      ${isHq ? '<div class="info-row"><span class="info-key">👑 Status</span><span class="info-val">Guild HQ</span></div>' : ''}
      <div class="info-row"><span class="info-key">🔗 Connections</span><span class="info-val">${conns} (×${connMult} tower HP)</span></div>
      <div class="info-row"><span class="info-key">⏱ Treasury Bonus</span><span class="info-val"><span class="treasury-badge">+${treaPct}%</span></span></div>
      <div class="info-divider"></div>
      <div class="mc-label" style="margin-bottom:6px;">Production / tick (base → actual)</div>`;

    if (t) {
      ['emeralds','wood','ore','crops','fish'].forEach(k => {
        const base = t.resources[k] || 0;
        if (!base) return;
        const mult = k === 'emeralds' ? emMult : resMult;
        const eff  = Math.floor(base * mult);
        html += `<div class="info-row"><span class="info-key">${RES_ICONS[k]} ${k}</span><span class="info-val">${fmt(base)} → ${fmt(eff)}</span></div>`;
      });
    }

    const upgRadar = ['damage','attackSpeed','health','defense'].filter(c => upg[c]);
    const bonRadar = Object.keys(BONUS_DEFS).filter(k => bon[k]);
    if (upgRadar.length || bonRadar.length) {
      html += `<div class="info-divider"></div><div class="mc-label" style="margin-bottom:6px;">Upgrades & Bonuses</div>`;
      upgRadar.forEach(c => {
        html += `<div class="info-row"><span class="info-key">${UPGRADE_ICON[c]} ${UPGRADE_LABEL[c]}</span><span class="info-val">Lv${upg[c]}/11</span></div>`;
      });
      bonRadar.forEach(k => {
        const def = BONUS_DEFS[k];
        html += `<div class="info-row"><span class="info-key">${def.icon} ${def.label}</span><span class="info-val">Lv${bon[k]}/${def.maxLevel}</span></div>`;
      });
    }

    E.tMenuBody.innerHTML = html;
  }

  // ─── Socket Controller ────────────────────────────────────────────────────────
  const socketCtrl = {
    connect() {
      const base = getSocketBase();
      if (!base) { E.statusText.textContent = 'No socket URL'; return; }
      state.socketBase = base;
      const token = getSharedToken();
      state.socket = io(base, { auth: token ? { token } : {}, transports: ['websocket', 'polling'] });

      state.socket.on('connect', () => {
        state.connected = true;
        E.statusText.textContent = '🟢 ' + base.replace('https://', '').replace('http://', '');
        this.tryResume();
      });
      state.socket.on('disconnect', () => {
        state.connected = false;
        E.statusText.textContent = '🔴 Disconnected';
      });

      state.socket.on('roomState', room => {
        state.currentRoom = room;
        if (!state.role) state.role = inferRole(room);
        // Sync local selectedSet from server
        state.selectedSet = new Set(room.selectedTerritories || []);
        renderSidebar();
        updateAllStyles();
        renderRoutes();
        refreshMenuIfOpen();
      });

      state.socket.on('tick:update', payload => {
        const res = payload.defenderResources || {};
        E.resEm.textContent = fmt(res.emeralds);
        E.resWo.textContent = fmt(res.wood);
        E.resOr.textContent = fmt(res.ore);
        E.resCr.textContent = fmt(res.crops);
        E.resFi.textContent = fmt(res.fish);
        const msgs = payload.messages || [];
        E.tickMsgs.innerHTML = msgs.slice(0, 8).map(m => `<li style="font-size:11px;color:#f8d9a7;">${m}</li>`).join('');
        if (payload.nextTickInMs) startTickCd(payload.nextTickInMs);
        refreshMenuIfOpen();
      });

      state.socket.on('prepTick', payload => {
        if (state.currentRoom) {
          state.currentRoom.prepSecondsRemaining = payload.secondsRemaining;
          if (payload.warEstimates) state.warEstimates = payload.warEstimates;
        }
        E.prepCd.style.display = 'block';
        E.prepCd.textContent = '⏱ Prep ends in: ' + payload.secondsRemaining + 's';
        if (state.role === 'attacker') renderWarPanel();
        renderSidebar();
      });

      state.socket.on('statusChanged', ({ status }) => {
        if (state.currentRoom) state.currentRoom.status = status;
        renderSidebar();
        if (status === 'lobby') {
          E.warCdBar.style.display = 'none';
          if (state.warCdTimer) { clearInterval(state.warCdTimer); state.warCdTimer = null; }
        }
      });

      state.socket.on('war:estimates', payload => {
        state.warEstimates = payload;
        renderSidebar();
        if (state.role === 'attacker') renderWarPanel();
      });

      state.socket.on('war:started', stats => {
        if (state.currentRoom) {
          state.currentRoom.warStartedAt  = Date.now();
          state.currentRoom.warTimeSeconds = stats.warTimeSeconds;
          state.currentRoom.warTowerStats  = stats;
        }
        E.warPanel.style.display = 'none';
        startWarCountdown(Date.now(), stats.warTimeSeconds);
        playSfx('warn');
      });

      state.socket.on('war:ended', ({ result, warTowerStats }) => {
        E.warCdBar.style.display = 'none';
        if (state.warCdTimer) { clearInterval(state.warCdTimer); state.warCdTimer = null; }
        showWarResult(result, warTowerStats);
        playSfx(result === 'attacker_wins' ? 'success' : 'warn');
      });

      state.socket.on('upgrade:applied', () => { playSfx('success'); refreshMenuIfOpen(); });
      state.socket.on('bonus:applied',   () => { playSfx('success'); refreshMenuIfOpen(); });
      state.socket.on('roomError', ({ error }) => alert('Server: ' + error));
    },

    tryResume() {
      if (state.resumeInFlight) return;
      const sess = loadSession();
      if (!sess) return;
      state.resumeInFlight = true;
      state.socket.emit('resumeRoom', { roomId: sess.roomId, playerToken: sess.playerToken }, res => {
        state.resumeInFlight = false;
        if (res && res.ok) {
          state.role = res.role;
          if (res.role === 'defender') state.armedForDefenderCreate = true;
        } else {
          clearSession();
        }
      });
    },

    createRoom() {
      if (!state.connected) { alert('Not connected.'); return; }
      state.socket.emit('createRoom', null, res => {
        if (res && res.ok) {
          state.role = 'defender';
          saveSession({ roomId: res.roomId, playerToken: res.playerToken, role: 'defender' });
        } else {
          alert(res && res.error ? res.error : 'Could not create room.');
        }
      });
    },

    joinRoom(code) {
      if (!state.connected || !/^\d{6}$/.test(code)) { alert('Enter a valid 6-digit room code.'); return; }
      state.socket.emit('joinRoom', { roomId: code }, res => {
        if (res && res.ok) {
          state.role = 'attacker';
          saveSession({ roomId: res.roomId, playerToken: res.playerToken, role: 'attacker' });
        } else {
          alert(res && res.error ? res.error : 'Could not join.');
        }
      });
    },

    syncSelection() {
      const room = state.currentRoom;
      if (!room || room.status !== 'lobby' || state.role !== 'defender') return;
      state.socket.emit('updateSelection', { selectedTerritories: Array.from(state.selectedSet) }, () => {});
    },

    setReady(ready) {
      if (!state.socket || !state.currentRoom) return;
      state.socket.emit('setReady', { ready }, res => { if (res && !res.ok) alert(res.error); });
    },

    applyUpgrade(terrName, category) {
      if (!state.socket) return;
      state.socket.emit('upgrade:apply', { territoryName: terrName, category }, res => {
        if (res && !res.ok) alert(res.error || 'Upgrade failed.');
      });
    },

    applyBonus(terrName, bonusKey) {
      if (!state.socket) return;
      state.socket.emit('bonus:apply', { territoryName: terrName, bonusKey }, res => {
        if (res && !res.ok) alert(res.error || 'Bonus failed.');
      });
    },

    setHqTerritory(terrName) {
      if (!state.socket) return;
      state.socket.emit('setHqTerritory', { territoryName: terrName }, res => {
        if (res && !res.ok) alert(res.error);
      });
    },

    setRouteMode(terrName, routeMode) {
      if (!state.socket) return;
      state.socket.emit('setTerritoryRouteMode', { territoryName: terrName, routeMode }, () => {});
    },

    setTaxRate(terrName, enemy, ally) {
      if (!state.socket) return;
      state.socket.emit('setTaxRate', { territoryName: terrName, enemy, ally }, res => {
        if (res && res.ok) playSfx('success');
        else if (res && res.error) alert(res.error);
      });
    },

    selectWarType(warType) {
      if (!state.socket) return;
      state.socket.emit('attacker:selectWarType', { warType }, res => {
        if (res && res.ok) {
          state.warEstimates = { towerStats: state.warEstimates && state.warEstimates.towerStats, estimates: res.estimates };
        }
      });
    },

    requestWarEstimates() {
      if (!state.socket) return;
      state.socket.emit('war:getEstimates', null, res => {
        if (res && res.ok) { state.warEstimates = res; if (state.role === 'attacker') renderWarPanel(); }
      });
    },
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function inferRole(room) {
    if (!state.socket || !state.socket.id) return state.role;
    if (room.defenderSocketId === state.socket.id) return 'defender';
    if (room.attackerSocketId === state.socket.id) return 'attacker';
    return state.role;
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────────
  E.createBtn.addEventListener('click', () => socketCtrl.createRoom());
  E.joinBtn.addEventListener('click', () => socketCtrl.joinRoom((E.joinInput.value || '').trim()));
  E.joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') socketCtrl.joinRoom((E.joinInput.value || '').trim()); });

  E.copyCode.addEventListener('click', () => {
    const code = state.currentRoom && state.currentRoom.id;
    if (code) navigator.clipboard.writeText(code).catch(() => {});
  });

  E.readyBtn.addEventListener('click', () => {
    const room = state.currentRoom;
    if (!room) return;
    const myReady = state.role === 'defender' ? room.defenderReady : room.attackerReady;
    socketCtrl.setReady(!myReady);
  });

  E.sfxBtn.addEventListener('click', () => {
    state.sfxEnabled = !state.sfxEnabled;
    E.sfxBtn.textContent = 'SFX: ' + (state.sfxEnabled ? 'ON' : 'OFF');
  });

  E.openManageBtn.addEventListener('click', () => {
    const room = state.currentRoom;
    const selected = room && room.selectedTerritories;
    if (selected && selected.length) openMenu(state.activeMenu || selected[0]);
  });

  // Menu tabs
  document.querySelectorAll('.tmenu-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tmenu-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      state.activeTab = this.dataset.tab;
      renderMenuContent();
    });
  });
  E.tMenuSelect.addEventListener('change', function () {
    state.activeMenu = this.value;
    renderMenuContent();
  });
  E.tMenuCloseBtn.addEventListener('click', closeMenu);
  E.tMenuOverlay.addEventListener('click', e => { if (e.target === E.tMenuOverlay) closeMenu(); });

  // War result
  E.warResultClose.addEventListener('click', () => { E.warResultOver.style.display = 'none'; });

  // ─── Boot ────────────────────────────────────────────────────────────────────
  initMap()
    .then(() => socketCtrl.connect())
    .catch(e => console.error('Boot failed', e));
})();
