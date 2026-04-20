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
  const MAP_SCALE_X    = 1.000;
  const MAP_SCALE_Y    = 1.000;
  const MAP_BG_SCALE_X = 0.803;
  const MAP_BG_SCALE_Y = 0.966;
  const FLIP_Z = true;
  const SOCKET_DEV_PORT = 3001;
  const SESSION_KEY_PREFIX = 'ecoWarRoomSessionV2';

  const UPGRADE_COSTS_PER_LEVEL = [0, 100, 300, 600, 1200, 2400, 4800, 8400, 12000, 15600, 19200, 22800];
  // Tower upgrades — hourly drain, paid per tick
  const UPGRADE_RESOURCE = { damage: 'ore', attackSpeed: 'crops', health: 'wood', defense: 'fish' };
  const UPGRADE_ICON     = { damage: '⚔', attackSpeed: '⚡', health: '❤', defense: '🛡' };
  const UPGRADE_LABEL    = { damage: 'Damage', attackSpeed: 'Atk Speed', health: 'Health', defense: 'Defense' };
  // Storage upgrades — one-time cost, separate for emeralds vs resources
  const EMERALD_STORAGE_COSTS_WOOD = [0, 100, 220, 400, 650, 950, 1350, 1850, 2500, 3300, 4300, 5500];
  const RESOURCE_STORAGE_COSTS_EM  = [0, 300, 650, 1100, 1700, 2500, 3500, 4700, 6200, 8000, 10100, 12500];

  const BONUS_DEFS = {
    // ── Row 1: Tower bonuses ──
    strongerMobs:       { icon: '💀', label: 'Stronger Minions',     desc: 'Mob damage bonus (+level)',          resource: 'wood',     costs: [0,1200,2400,4800],      maxLevel: 3 },
    multiAttack:        { icon: '⚔⚔', label: 'Tower Multi Target',  desc: 'Tower hits 2 targets',               resource: 'fish',     costs: [0,3200],                 maxLevel: 1 },
    aura:               { icon: '🔥', label: 'Tower Aura',          desc: 'True dmg — inner circle',            resource: 'crops',    costs: [0,2000,4000,8000],       maxLevel: 3 },
    volley:             { icon: '💥', label: 'Tower Volley',        desc: 'True dmg — outer circle',            resource: 'ore',      costs: [0,2000,4000,8000],       maxLevel: 3 },
    // ── Row 2: Experience & Seeking bonuses ──
    gatheringExp:       { icon: '🌿', label: 'Gathering XP',        desc: '+gathering experience per level',    resource: 'crops',    costs: [0,400,800,1200,1600,2000,2400,2800], maxLevel: 8 },
    mobExp:             { icon: '🧟', label: 'Mob XP',              desc: '+mob experience per level',          resource: 'ore',      costs: [0,400,800,1200,1600,2000,2400,2800], maxLevel: 8 },
    mobDamage:          { icon: '🗡', label: 'Mob Damage',          desc: '+mob damage per level',              resource: 'wood',     costs: [0,400,800,1200,1600,2000,2400,2800], maxLevel: 8 },
    pvpDamage:          { icon: '⚡', label: 'PvP Damage',          desc: '+PvP damage per level',              resource: 'fish',     costs: [0,400,800,1200,1600,2000,2400,2800], maxLevel: 8 },
    xpSeeking:          { icon: '📘', label: 'XP Seeking',          desc: '+XP seeking per level',              resource: 'emeralds', costs: [0,600,1200,1800,2400,3000,3600,4200], maxLevel: 8 },
    tomeSeeking:        { icon: '📕', label: 'Tome Seeking',        desc: '+tome seeking per level',            resource: 'emeralds', costs: [0,1000,2000,3000],       maxLevel: 3 },
    emeraldSeeking:     { icon: '💎', label: 'Emerald Seeking',     desc: '+emerald seeking per level',         resource: 'ore',      costs: [0,600,1200,1800,2400,3000,3600,4200], maxLevel: 8 },
    // ── Row 3: Economy & Storage bonuses ──
    largerResourceStorage: { icon: '📦', label: 'Larger Res Storage',  desc: '+resource storage capacity',       resource: 'wood',     costs: [0,500,1000,1500,2000,2500,3000,3500], maxLevel: 8 },
    largerEmeraldStorage:  { icon: '💰', label: 'Larger Em Storage',   desc: '+emerald storage capacity',        resource: 'crops',    costs: [0,500,1000,1500,2000,2500,3000,3500], maxLevel: 8 },
    efficientResources:    { icon: '📈', label: 'Efficient Resources', desc: '+10% resource production / lv',    resource: 'emeralds', costs: [0,800,1600,2400,3200,4000],           maxLevel: 6 },
    efficientEmeralds:     { icon: '💰', label: 'Efficient Emeralds',  desc: '+10% emerald production / lv',     resource: 'crops',    costs: [0,800,1600,2400],                     maxLevel: 3 },
    resourceRate:          { icon: '⏱', label: 'Resource Rate',       desc: '+10% faster resource ticks / lv',  resource: 'emeralds', costs: [0,1000,2000,3000],                    maxLevel: 3 },
    emeraldRate:           { icon: '⏱', label: 'Emerald Rate',        desc: '+10% faster emerald ticks / lv',   resource: 'ore',      costs: [0,1000,2000,3000],                    maxLevel: 3 },
  };

  const WAR_TYPES = {
    solo:   { label: 'Solo Warrer',      dps: 150000,   icon: '⚔',    color: '#ffcc44' },
    normal: { label: 'Normal War Team',  dps: 2000000,  icon: '⚔⚔',  color: '#ff8844' },
    elite:  { label: 'Elite War Team',   dps: 4000000,  icon: '⚔⚔⚔', color: '#ff4444' }
  };

  const HQ_BASE_STORE  = { emeralds: 5000,   resource: 1500   };
  const HQ_MAX_STORE   = { emeralds: 400000, resource: 120000 };
  // Treasury tier thresholds (ms) and bonus values — tiered system matching live game
  const TREASURY_TIER_MS     = [3600000, 86400000, 432000000]; // 1hr, 24hr, 5 days
  const TREASURY_TIER_BONUS  = [0.10, 0.20, 0.25];
  const TREASURY_TIER_LABELS = ['1+ hour: +10%', '24+ hours: +20%', '5+ days: +25%'];

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
    attackCdTimer: null,
    activeMenu: null,
    activeTab: 'upgrades',
    warEstimates: null,
    selectedWarType: 'normal',
    attackPanelTerritory: null,
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
    // Territory menu modal
    tMenuOverlay:   $('tMenuOverlay'),
    tMenuTitle:     $('tMenuTitle'),
    tMenuSelect:    $('tMenuSelect'),
    tMenuCloseBtn:  $('tMenuCloseBtn'),
    tMenuBody:      $('tMenuBody'),
    // War team sidebar panel (attacker)
    warTeamPanel:   $('warTeamPanel'),
    warTypeCards:   $('warTypeCards'),
    attackStatusBar:$('attackStatusBar'),
    // Attack panel overlay
    attackOverlay:  $('attackOverlay'),
    attackPanelBody:$('attackPanelBody'),
    attackCloseBtn: $('attackCloseBtn'),
    // War result
    warResultOver:  $('warResultOverlay'),
    warResultHdr:   $('warResultHdr'),
    warResultStats: $('warResultStats'),
    warResultClose: $('warResultCloseBtn'),
  };

  // ─── Utilities ───────────────────────────────────────────────────────────────
  const fmt = v => (Number(v) || 0).toLocaleString();
  const fmtTime = s => Math.floor(Math.max(0,s) / 60) + 'm ' + String(Math.max(0,s) % 60).padStart(2, '0') + 's';
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
      if (!p || !/^\d{6}$/.test(p.roomId || '') || !p.playerToken) return null;
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

  // ─── Map Coordinates ─────────────────────────────────────────────────────────
  // World coordinate bounds (matches territories-map.js constants exactly)
  const xMin = MAP_X_MIN, xMax = MAP_X_MAX;
  const zMin = MAP_Z_MIN, zMax = MAP_Z_MAX;

  function worldToLayer(x, z, imgW, imgH) {
    const westSpan  = Math.abs(xMin) || 1;
    const eastSpan  = Math.abs(xMax) || 1;
    const northSpan = Math.abs(zMin) || 1;
    const southSpan = Math.abs(zMax) || 1;
    let nx = x < 0 ? 0.5 - 0.5 * (Math.abs(x) / westSpan) : 0.5 + 0.5 * (Math.abs(x) / eastSpan);
    let ny = z <= 0 ? 1 - (Math.abs(z) / northSpan) : 1 + (Math.abs(z) / southSpan);
    nx = clamp01(nx); ny = clamp01(ny);
    if (FLIP_Z) ny = 1 - ny;
    const snx = 0.5 + (nx - 0.5) * MAP_SCALE_X;
    const sny = 0.5 + (ny - 0.5) * MAP_SCALE_Y;
    // Territory rectangles are placed in FULL imgW/imgH space.
    // MAP_BG_SCALE_X/Y only shrink the image overlay bounds, not territory coords.
    return L.latLng(sny * imgH + MAP_OFFSET_Y_PX, snx * imgW + MAP_OFFSET_X_PX);
  }

  /** Returns the Leaflet bounds for the image overlay (shrunk by BG_SCALE, centered). */
  function getImageOverlayBounds(imgW, imgH) {
    const scaledW = imgW * MAP_BG_SCALE_X;
    const scaledH = imgH * MAP_BG_SCALE_Y;
    const minLng  = (imgW - scaledW) / 2;
    const maxLng  = minLng + scaledW;
    const minLat  = (imgH - scaledH) / 2;
    const maxLat  = minLat + scaledH;
    return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
  }
  function boundsFromWorldRect(t, imgW, imgH) {
    const corners = [
      worldToLayer(t.minX, t.minZ, imgW, imgH), worldToLayer(t.maxX, t.minZ, imgW, imgH),
      worldToLayer(t.maxX, t.maxZ, imgW, imgH), worldToLayer(t.minX, t.maxZ, imgW, imgH),
    ];
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    corners.forEach(c => {
      if (c.lat < minLat) minLat = c.lat; if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng; if (c.lng > maxLng) maxLng = c.lng;
    });
    return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
  }
  function territoryCenterLatLng(name, imgW, imgH) {
    const t = state.territoryByName.get(name);
    if (!t) return null;
    return worldToLayer((t.minX + t.maxX) / 2, (t.minZ + t.maxZ) / 2, imgW, imgH);
  }
  // Convenience wrappers that read imgW/imgH from state
  function boundsFromWorldRectS(t) { const g = state.geo; return boundsFromWorldRect(t, g.imgW, g.imgH); }
  function territoryCenterS(name)  { const g = state.geo; return territoryCenterLatLng(name, g.imgW, g.imgH); }

  // ─── HQ Capacity ─────────────────────────────────────────────────────────────
  function hqEmeraldCap(emStorLv) {
    const lv = clamp(emStorLv || 0, 0, 11);
    return Math.floor(HQ_BASE_STORE.emeralds + (lv / 11) * (HQ_MAX_STORE.emeralds - HQ_BASE_STORE.emeralds));
  }
  function hqResourceCap(resStorLv) {
    const lv = clamp(resStorLv || 0, 0, 11);
    return Math.floor(HQ_BASE_STORE.resource + (lv / 11) * (HQ_MAX_STORE.resource - HQ_BASE_STORE.resource));
  }
  // Convenience: get the effective cap for any resource key given upgrade levels object
  function hqCap(upgrades, resKey) {
    if (resKey === 'emeralds') return hqEmeraldCap((upgrades && upgrades.largerEmeraldStorage) || 0);
    return hqResourceCap((upgrades && upgrades.largerResourceStorage) || 0);
  }


  // ─── Territory Styling ───────────────────────────────────────────────────────
  function styleFor(name) {
    const room = state.currentRoom;
    const hq   = room && room.hqTerritory ? room.hqTerritory : '';
    const defSel  = room ? (room.selectedTerritories || []) : Array.from(state.selectedSet);
    const capSet  = new Set(room ? (room.attackerCapturedTerritories || []) : []);
    const inAttack = room && room.currentAttack && room.currentAttack.territory === name;
    const sel  = state.selectedSet.has(name) || defSel.includes(name);
    const isHq = !!hq && name === hq;

    // Attacker captured → red
    if (capSet.has(name)) return { color: '#ff4444', weight: 2, fillColor: '#aa0000', fillOpacity: 0.55, opacity: 1 };
    // Active battle → orange flash
    if (inAttack && room.currentAttack.phase === 'battle')
      return { color: '#ff8800', weight: 3, fillColor: '#ff5500', fillOpacity: 0.60, opacity: 1 };
    // Queue phase → yellow
    if (inAttack)
      return { color: '#ffee00', weight: 3, fillColor: '#ffe000', fillOpacity: 0.45, opacity: 1 };
    // Normal defender territory
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
        adj.get(from).add(to); adj.get(to).add(from);
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
    // All trade connections between selected territories — uniform solid lines
    const drawn = new Set();
    selected.forEach(name => {
      const t = state.territoryByName.get(name);
      if (!t || !t.tradeRoutes) return;
      t.tradeRoutes.forEach(other => {
        if (!selectedSet.has(other)) return;
        const key = name < other ? name + '|' + other : other + '|' + name;
        if (drawn.has(key)) return;
        drawn.add(key);
        const s = territoryCenterS(name), e = territoryCenterS(other);
        if (!s || !e) return;
        L.polyline([s, e], { color: '#ffe08a', weight: 2, opacity: 0.85 }).addTo(state.routeLayer);
      });
    });
    // Crown on HQ
    const ctr = territoryCenterS(hq);
    if (ctr) {
      const icon = L.divIcon({ className: '', html: '<div style="font-size:18px;text-shadow:0 1px 4px #000;line-height:1;">&#x1F451;</div>', iconSize: [20, 20], iconAnchor: [10, 10] });
      state.hqMarker = L.marker(ctr, { icon, interactive: false }).addTo(state.map);
    }
  }

  // ─── Territory Click ─────────────────────────────────────────────────────────
  function onTerritoryClick(name) {
    const room = state.currentRoom;
    const status = room ? room.status : 'lobby';

    if (status === 'playing') {
      if (state.role === 'attacker') {
        // Attacker: clicking a defender territory → attack panel
        const defTerr = room.selectedTerritories || [];
        if (defTerr.includes(name)) { showAttackPanel(name); return; }
        // Clicking own captured territory or neutral → ignore
        return;
      }
      // Defender → territory menu
      openMenu(name); return;
    }
    if (status === 'prep') { openMenu(name); return; }

    // Lobby: toggle selection (defender only)
    if (state.role === 'attacker') return;
    if (state.selectedSet.has(name)) state.selectedSet.delete(name);
    else state.selectedSet.add(name);
    updateAllStyles(); renderRoutes(); renderSidebar();
    socketCtrl.syncSelection();
  }

  // ─── Map Init ─────────────────────────────────────────────────────────────────
  function readTradeRoutes(row) {
    const tr = row['Trading Routes'] || row.tradingRoutes || row.trade_routes;
    return Array.isArray(tr) ? tr.map(String) : [];
  }
  function initMapLayers(territories, imgW, imgH) {
    territories.forEach(t => {
      state.territoryByName.set(t.name, t);
      const layer = L.rectangle(boundsFromWorldRect(t, imgW, imgH), styleFor(t.name));
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

    // Leaflet coordinate space spans the FULL image dimensions
    const fullBounds    = L.latLngBounds([[0, 0], [imgH, imgW]]);
    // Image overlay is placed at the BG-scaled sub-bounds (matches live map)
    const overlayBounds = getImageOverlayBounds(imgW, imgH);

    state.map = L.map(document.getElementById('map'), {
      crs: L.CRS.Simple, minZoom: -4, maxZoom: 4,
      zoomSnap: 0.25, zoomControl: true, attributionControl: false
    });
    L.imageOverlay(MAP_IMAGE_URL, overlayBounds).addTo(state.map);
    state.map.fitBounds(fullBounds);
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
          minX: Math.min(loc.start[0], loc.end[0]), maxX: Math.max(loc.start[0], loc.end[0]),
          minZ: Math.min(loc.start[1], loc.end[1]), maxZ: Math.max(loc.start[1], loc.end[1]),
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
      initMapLayers(territories, imgW, imgH);
    } catch (e) { console.error('Territory data load failed', e); }
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
    if (status === 'prep' && typeof room.prepSecondsRemaining === 'number') {
      E.prepCd.style.display = 'block';
      E.prepCd.textContent = '⏱ Prep ends in: ' + room.prepSecondsRemaining + 's';
    } else { E.prepCd.style.display = 'none'; }

    // Ready (lobby only)
    E.readySection.style.display = status === 'lobby' ? 'block' : 'none';
    E.readyStateText.textContent = 'Defender: ' + (room.defenderReady ? '✅' : '❌') + '  |  Attacker: ' + (room.attackerReady ? '✅' : '❌');
    const canReady = status === 'lobby' && !!state.role && !!room.defenderSocketId && !!room.attackerSocketId;
    E.readyBtn.disabled = !canReady;
    const myReady = state.role === 'defender' ? room.defenderReady : room.attackerReady;
    E.readyBtn.textContent = myReady ? '✅ UNREADY' : 'READY';

    // Resources panel (defender only during prep/playing)
    const showRes = (status === 'prep' || status === 'playing') && state.role === 'defender';
    E.resPanel.style.display = showRes ? 'block' : 'none';

    // Tower stats (attacker during prep only, shows HQ estimates)
    const showTower = status === 'prep' && state.role === 'attacker';
    E.towerPanel.style.display = showTower ? 'block' : 'none';
    if (showTower && state.warEstimates && state.warEstimates.towerStats) {
      const ts = state.warEstimates.towerStats;
      E.towerHP.textContent   = fmt(ts.towerHP);
      E.towerEHP.textContent  = fmt(ts.effectiveHP);
      E.towerConn.textContent = ts.connections;
      E.towerHLv.textContent  = ts.healthLevel;
      E.towerDLv.textContent  = ts.defenseLevel;
    }

    // War team selector (attacker: always show when no active attack in progress)
    const showWarTeam = state.role === 'attacker' && !room.currentAttack;
    if (E.warTeamPanel) E.warTeamPanel.style.display = (showWarTeam && status !== 'lobby') ? 'block' : 'none';
    if (showWarTeam && status !== 'lobby') renderWarTypeSelector();

    // Territory list
    const selected = room.selectedTerritories || Array.from(state.selectedSet);
    const captured = room.attackerCapturedTerritories || [];
    E.selCount.textContent = selected.length + (captured.length ? ' (-' + captured.length + ' taken)' : '');
    E.terrList.innerHTML = selected.slice(0, 50).map(name => {
      const isHq = name === room.hqTerritory;
      const upg = room.territoryUpgrades && room.territoryUpgrades[name];
      const parts = [];
      if (upg) {
        if (upg.damage) parts.push('D' + upg.damage);
        if (upg.attackSpeed) parts.push('A' + upg.attackSpeed);
        if (upg.health) parts.push('H' + upg.health);
        if (upg.defense) parts.push('DEF' + upg.defense);
      }
      const badge = parts.length ? `<span class="terr-badge">${parts.join(' ')}</span>` : '';
      const atk = room.currentAttack && room.currentAttack.territory === name;
      const atkStyle = atk ? `color:${room.currentAttack.phase === 'battle' ? '#ff8844' : '#ffe066'};` : '';
      return `<div class="terr-item" style="${atkStyle}">${isHq ? '👑 ' : ''}${atk ? (room.currentAttack.phase === 'battle' ? '⚔ ' : '⏳ ') : ''}<span style="flex:1;">${name}</span>${badge}</div>`;
    }).join('');
    if (captured.length) {
      E.terrList.innerHTML += captured.map(n =>
        `<div class="terr-item" style="color:#ff6660;"><span style="font-size:10px;">☠</span> <span style="flex:1;text-decoration:line-through;">${n}</span></div>`
      ).join('');
    }

    // Click hints
    if (status === 'lobby' && state.role === 'defender') {
      E.clickHint.textContent = 'Click territories to select/deselect';
    } else if (status === 'playing' && state.role === 'attacker') {
      E.clickHint.textContent = room.currentAttack ? '⚔ Attack in progress...' : '🗡 Click a defender territory to attack!';
    } else if (status === 'prep' || status === 'playing') {
      E.clickHint.textContent = 'Click territory on map to manage';
    } else { E.clickHint.textContent = ''; }

    E.openManageBtn.style.display = (showRes && selected.length) ? 'block' : 'none';

    // Attack status bar
    renderAttackStatus();
  }

  // ─── War Team Selector (attacker sidebar) ────────────────────────────────────
  function renderWarTypeSelector() {
    if (!E.warTypeCards) return;
    let html = '';
    Object.entries(WAR_TYPES).forEach(([type, def]) => {
      const sel = state.selectedWarType === type;
      html += `<div class="war-type-card-sb${sel ? ' sel' : ''}" data-type="${type}"
        style="cursor:pointer;padding:6px 10px;margin-bottom:4px;border:2px solid ${sel ? def.color : '#3a1a1a'};
               background:${sel ? 'rgba(30,8,8,0.98)' : 'rgba(18,8,8,0.85)'};">
        <div style="display:flex;align-items:center;gap:6px;">
          <span>${def.icon}</span>
          <span style="font-family:VT323,monospace;font-size:16px;color:${def.color};">${def.label}</span>
        </div>
        <div style="font-family:VT323,monospace;font-size:12px;color:#aa6666;">${fmt(def.dps)} DPS</div>
      </div>`;
    });
    E.warTypeCards.innerHTML = html;
    E.warTypeCards.querySelectorAll('.war-type-card-sb').forEach(card => {
      card.addEventListener('click', function () {
        state.selectedWarType = this.dataset.type;
        socketCtrl.selectWarType(this.dataset.type);
        renderWarTypeSelector();
      });
    });
  }

  // ─── Attack Status Bar ────────────────────────────────────────────────────────
  function renderAttackStatus() {
    const room = state.currentRoom;
    const atk = room && room.currentAttack;
    if (!E.attackStatusBar) return;
    if (!atk) {
      E.attackStatusBar.style.display = 'none';
      if (state.attackCdTimer) { clearInterval(state.attackCdTimer); state.attackCdTimer = null; }
      return;
    }
    E.attackStatusBar.style.display = 'block';
    const phase  = atk.phase;
    const endsAt = phase === 'queue' ? atk.queueEndsAt : atk.battleEndsAt;
    const rem    = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    const icon   = phase === 'queue' ? '⏳' : '⚔';
    const label  = phase === 'queue' ? 'Queue' : 'Battle';
    E.attackStatusBar.innerHTML = `<div style="font-family:VT323,monospace;font-size:16px;color:${phase==='battle'?'#ff8844':'#ffe066'};">${icon} ${label}: <b>${atk.territory}</b> — ${fmtTime(rem)}</div>`;
    if (!state.attackCdTimer) {
      state.attackCdTimer = setInterval(() => { renderAttackStatus(); updateAllStyles(); }, 500);
    }
  }

  // ─── Attack Panel Overlay ─────────────────────────────────────────────────────
  function showAttackPanel(name) {
    state.attackPanelTerritory = name;
    const room = state.currentRoom;
    const overlay = E.attackOverlay;
    const body    = E.attackPanelBody;
    if (!room || !overlay || !body) return;

    const captured    = room.attackerCapturedTerritories || [];
    const capSet      = new Set(captured);
    const defTerr     = room.selectedTerritories || [];
    const t           = state.territoryByName.get(name);
    const tradeRoutes = t ? t.tradeRoutes : [];
    const hasAdjCap   = tradeRoutes.some(r => capSet.has(r));
    const canAttack   = defTerr.includes(name) && (captured.length === 0 || hasAdjCap);
    const attackInProgress = !!room.currentAttack;
    const isThisAttack     = attackInProgress && room.currentAttack.territory === name;
    const isHq     = name === room.hqTerritory;

      // Estimate stats locally for display
    const upg     = room.territoryUpgrades && room.territoryUpgrades[name] ? room.territoryUpgrades[name] : {};
    const selSet  = new Set(defTerr);
    const conns   = tradeRoutes.filter(r => r !== name && selSet.has(r)).length;
    const wt      = WAR_TYPES[state.selectedWarType] || WAR_TYPES.normal;
    const hlv     = parseInt(upg.health || 0);
    const dlv     = parseInt(upg.defense || 0);
    const dmlv    = parseInt(upg.damage || 0);
    const towerHP = Math.floor(1000000 * (1 + hlv * 0.25) * (1 + 0.3 * conns));
    const defRed  = Math.min(0.80, dlv * 0.05);
    const ehp     = Math.floor(towerHP / (1 - defRed));
    // The combat outcome formula in index.html isn't fully accurate, but battle time relies on standard attacker DPS vs tower EHP.
    const battleSec = Math.ceil(ehp / wt.dps) + 30;
    const adjCap = tradeRoutes.some(r => capSet.has(r));
    const queueNote = adjCap ? 'hops+1 min (adjacent)' : '2 min base (no adjacent capture)';

    if (isThisAttack) {
      const phase  = room.currentAttack.phase;
      const endsAt = phase === 'queue' ? room.currentAttack.queueEndsAt : room.currentAttack.battleEndsAt;
      const rem    = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      body.innerHTML = `
        <div class="mc-title" style="margin-bottom:8px;">⚔ Attacking: ${name}${isHq?' 👑':''}</div>
        <div style="font-family:VT323,monospace;font-size:22px;color:${phase==='battle'?'#ff8844':'#ffe066'};">
          ${phase === 'queue' ? '⏳ Queue: ' : '⚔ Battle: '} ${fmtTime(rem)}
        </div>
        <div style="font-size:12px;color:#888;margin-top:6px;">Waiting for territory to fall…</div>`;
    } else if (!defTerr.includes(name)) {
      body.innerHTML = `<div class="mc-title">Not a defender territory</div>`;
    } else if (!canAttack) {
      body.innerHTML = `
        <div class="mc-title" style="margin-bottom:8px;">${name}${isHq?' 👑':''}</div>
        <div style="font-family:VT323,monospace;font-size:16px;color:#cc4444;">⛔ Cannot attack yet<br>
        Capture an adjacent territory first.</div>`;
    } else if (attackInProgress) {
      body.innerHTML = `
        <div class="mc-title" style="margin-bottom:8px;">${name}${isHq?' 👑':''}</div>
        <div style="font-family:VT323,monospace;font-size:16px;color:#cc8844;">⚠ Another attack is already in progress.<br>Wait for it to finish.</div>`;
    } else {
      // Check if allowed to attack (fixes UI showing clickable buttons when technically forbidden)
      let canStart = true;
      let startErr = '';
      if (room.status !== 'playing') { canStart = false; startErr = 'Playing phase only'; }
      if (state.role !== 'attacker') { canStart = false; startErr = 'Attacker only'; }

      const baseDps = Math.floor(500000 * (1 + dmlv * 0.25) * (1 + 0.3 * conns));
      
      const btnHtml = canStart 
        ? `<button id="confirmAttackBtn" class="mc-btn red" style="width:100%;font-size:22px;padding:9px 0;">⚔ START ATTACK</button>`
        : `<button disabled class="mc-btn disabled" style="width:100%;font-size:22px;padding:9px 0;opacity:0.6;cursor:not-allowed;">⛔ ${startErr}</button>`;

      body.innerHTML = `
        <div class="mc-title" style="margin-bottom:8px;">⚔ Attack: ${name}${isHq?' 👑':''}</div>
        <div style="font-family:VT323,monospace;font-size:15px;color:#3d2c18;line-height:1.7;margin-bottom:10px;">
          <div>EHP: <b>${fmt(ehp)}</b> &nbsp;|&nbsp; DPS: <b style="color:#dd6655;">${fmt(baseDps)}</b></div>
          <div>Connections: ${conns} &nbsp;|&nbsp; Health Lv: ${hlv} &nbsp;|&nbsp; Def Lv: ${dlv}</div>
          <div style="margin-top:4px;">War team: <b style="color:${wt.color};">${wt.icon} ${wt.label}</b> (${fmt(wt.dps)} DPS)</div>
          <div style="color:#5a3820;">⏳ Queue: ~${queueNote}</div>
          <div style="color:#5a3820;">⚔ Battle: ~${fmtTime(battleSec)}</div>
          ${isHq ? '<div style="color:#cc2222;font-size:17px;margin-top:4px;">☠ HQ — capturing this ends the war!</div>' : ''}
        </div>
        ${btnHtml}`;

      const btn = body.querySelector('#confirmAttackBtn');
      if (btn) btn.addEventListener('click', () => {
        if (!state.socket) return;
        btn.textContent = '⏳ Starting...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        state.socket.emit('attacker:attack', { territoryName: name }, res => {
          if (res && res.ok) {
            overlay.style.display = 'none';
          } else {
            btn.textContent = '⚔ START ATTACK';
            btn.disabled = false;
            btn.style.opacity = '1';
            alert('Attack failed: ' + (res ? res.error : '?'));
          }
        });
      });
    }
    overlay.style.display = 'flex';
  }

  // ─── War Result ───────────────────────────────────────────────────────────────
  function showWarResult(result, capturedTerritory, stats) {
    const atkWins = result === 'attacker_wins';
    E.warResultHdr.className = 'war-result-hdr ' + (atkWins ? 'atk' : 'def');
    E.warResultHdr.textContent = atkWins ? '⚔ TERRITORY CAPTURED!' : '🛡 DEFENSE HELD!';
    const rows = [];
    if (capturedTerritory) rows.push(['Territory', capturedTerritory]);
    if (stats) {
      const wtn = WAR_TYPES[stats.warType] || WAR_TYPES.normal;
      rows.push(
        ['Tower HP',    fmt(stats.towerHP || 0)],
        ['Effective HP',fmt(stats.effectiveHP || 0)],
        ['War Team',    wtn.label],
        ['Queue Time',  fmtTime(stats.queueSeconds || 0)],
        ['Battle Time', fmtTime(stats.battleSeconds || 0)],
      );
    }
    E.warResultStats.innerHTML = rows.map(([k,v]) =>
      `<div class="wr-stat"><span class="wr-key">${k}</span><span class="wr-val">${v}</span></div>`
    ).join('');
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
    if (E.tMenuSelect) {
      E.tMenuSelect.innerHTML = selected.map(t =>
        `<option value="${t}"${t === name ? ' selected' : ''}>${t}${t === room.hqTerritory ? ' 👑' : ''}</option>`
      ).join('');
    }
    renderMenuContent();
    if (E.tMenuOverlay) E.tMenuOverlay.style.display = 'flex';
  }
  function closeMenu() { if (E.tMenuOverlay) E.tMenuOverlay.style.display = 'none'; state.activeMenu = null; }
  function refreshMenuIfOpen() {
    if (state.activeMenu && E.tMenuOverlay && E.tMenuOverlay.style.display !== 'none') renderMenuContent();
  }

  function renderMenuContent() {
    const name = state.activeMenu;
    const room = state.currentRoom;
    if (!name || !room) return;
    E.tMenuTitle.textContent = name + (name === room.hqTerritory ? ' 👑' : '');
    const isDefender  = state.role === 'defender';
    const interactive = (room.status === 'prep' || room.status === 'playing') && isDefender;
    const tab = state.activeTab;
    if      (tab === 'upgrades')    renderTabUpgrades(name, room, interactive);
    else if (tab === 'bonuses')     renderTabBonuses(name, room, interactive);
    else if (tab === 'costOutput')  renderTabCostOutput(name, room, interactive);
    else if (tab === 'storage')     renderTabStorage(name, room, interactive);
    else if (tab === 'tradeRoute')  renderTabTradeRoute(name, room, interactive);
    else if (tab === 'tax')         renderTabTax(name, room, interactive);
    else if (tab === 'setHq')       renderTabSetHq(name, room, interactive);
  }

  /* ── Guild Tower (Upgrades) ─────────────────────────────────────────────── */
  function renderTabUpgrades(name, room, interactive) {
    const upg = (room.territoryUpgrades && room.territoryUpgrades[name]) || {};
    const t    = state.territoryByName.get(name);
    const sel  = room.selectedTerritories || [];
    const selSt = new Set(sel);
    const routes = t ? t.tradeRoutes : [];
    const conns  = routes.filter(r => r !== name && selSt.has(r)).length;
    const cats = ['damage', 'attackSpeed', 'health', 'defense'];

    let html = '<div class="upg-grid">';
    cats.forEach(cat => {
      const lv = parseInt(upg[cat] || 0);
      const maxed = lv >= 11;
      const drain = UPGRADE_COSTS_PER_LEVEL[lv] || 0;
      const nextD = maxed ? 0 : (UPGRADE_COSTS_PER_LEVEL[lv + 1] || 0);
      const bars  = Array.from({length: 11}, (_, i) => `<span class="${i < lv ? 'on' + (maxed ? ' maxed' : '') : ''}"></span>`).join('');
      const iconCls = interactive && !maxed ? 'upg-icon-btn' : 'upg-icon-btn' + (maxed ? ' maxed' : '');
      html += `<div class="upg-card${maxed ? ' maxed' : ''}">
        <div class="upg-hdr">
          <div class="${iconCls}" data-cat="${cat}" title="L-click: upgrade, R-click: downgrade" style="font-size:28px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:${maxed?'#c0d4a8':'#e8dcc0'};border:2px solid ${maxed?'#5a9a3a':'#7a6a50'};cursor:${interactive&&!maxed?'pointer':'default'};user-select:none;position:relative;">
            ${UPGRADE_ICON[cat]}
            ${interactive && !maxed ? '<span style="position:absolute;bottom:1px;right:2px;font-size:9px;color:#888;font-family:VT323,monospace;pointer-events:none;">±</span>' : ''}
          </div>
          <div style="flex:1;">
            <div class="upg-name">${UPGRADE_LABEL[cat]}</div>
            <div class="upg-res">${UPGRADE_RESOURCE[cat]}</div>
          </div>
          <span class="lv-badge${maxed?' maxed':''}" style="font-size:20px;">${lv}/11</span>
        </div>
        <div class="seg-bar" style="margin:4px 0;">${bars}</div>
        <div class="upg-cost">Drain: ${drain ? fmt(drain) + '/hr' : '—'}${!maxed ? ' → Next: ' + fmt(nextD) + '/hr' : ''}</div>
      </div>`;
    });
    html += '</div>';

    // Nearby territories & tower stats
    const hlv = parseInt(upg.health || 0); const dlv = parseInt(upg.defense || 0); const dmlv = parseInt(upg.damage || 0);
    const baseHp = Math.floor(1000000 * (1 + hlv * 0.25) * (1 + 0.3 * conns));
    const defRed = Math.min(0.80, dlv * 0.05);
    const ehp = Math.floor(baseHp / (1 - defRed));
    const baseDps = Math.floor(500000 * (1 + dmlv * 0.25) * (1 + 0.3 * conns));
    html += `<div style="margin-top:10px;background:#b8a870;border:2px solid #9a8558;padding:8px;">
      <div class="mc-label" style="margin-bottom:4px;">🏰 Tower Stats</div>
      <div class="info-row"><span class="info-key">🔗 Nearby Territories</span><span class="info-val">${conns}</span></div>
      <div class="info-row"><span class="info-key">🛡 Tower HP</span><span class="info-val">${fmt(baseHp)}</span></div>
      <div class="info-row"><span class="info-key">🛡 Effective HP</span><span class="info-val">${fmt(ehp)}</span></div>
      <div class="info-row"><span class="info-key">⚔ Tower DPS</span><span class="info-val">${fmt(baseDps)}</span></div>
    </div>`;

    E.tMenuBody.innerHTML = html;

    // Clickable icon handlers
    if (interactive) {
      E.tMenuBody.querySelectorAll('.upg-icon-btn').forEach(icon => {
        const lv = parseInt(icon.dataset.lv || 0);
        if (!icon.classList.contains('maxed')) {
          icon.addEventListener('click', function (e) {
            e.preventDefault();
            socketCtrl.applyUpgrade(name, this.dataset.cat);
          });
        }
        if (lv > 0) {
          icon.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            socketCtrl.applyDowngrade(name, this.dataset.cat);
          });
        }
      });
    }
  }

  /* ── Bonuses (3-row grid with clickable icons) ───────────────────────────── */
  const BONUS_ROWS = [
    ['strongerMobs','multiAttack','aura','volley'],
    ['gatheringExp','mobExp','mobDamage','pvpDamage','xpSeeking','tomeSeeking','emeraldSeeking'],
    ['largerResourceStorage','largerEmeraldStorage','efficientResources','efficientEmeralds','resourceRate','emeraldRate'],
  ];
  function renderTabBonuses(name, room, interactive) {
    const bon = (room.territoryBonuses && room.territoryBonuses[name]) || {};
    let html = '';
    BONUS_ROWS.forEach((row, ri) => {
      html += `<div class="bonus-sec-hdr" style="margin-top:${ri?'8':'0'}px;">${ri===0?'🏰 Tower':ri===1?'⚔ Combat & Seeking':'📈 Economy'} Bonuses</div>`;
      html += '<div class="bonus-grid">';
      row.forEach(key => {
        const def = BONUS_DEFS[key]; if (!def) return;
        const lv = parseInt(bon[key] || 0); const maxed = lv >= def.maxLevel;
        const drain = def.costs[lv] || 0;
        html += `<div class="bonus-item">
          <div class="b-icon" data-key="${key}" data-lv="${lv}" style="cursor:${interactive&&!maxed?'pointer':'default'};">
            ${def.icon}
            ${interactive && !maxed ? '<span class="b-hint">±</span>' : ''}
          </div>
          <div class="b-info">
            <div class="b-name">${def.label}</div>
            <div class="b-lv">${lv}/${def.maxLevel}${drain ? ' | '+fmt(drain)+'/hr' : ''}</div>
          </div>
        </div>`;
      });
      html += '</div>';
    });
    E.tMenuBody.innerHTML = html;
    if (interactive) {
      E.tMenuBody.querySelectorAll('.b-icon').forEach(icon => {
        const key = icon.dataset.key;
        const def = BONUS_DEFS[key]; if (!def) return;
        const lv = parseInt(icon.dataset.lv || 0);
        if (lv < def.maxLevel) {
          icon.addEventListener('click', () => socketCtrl.applyBonus(name, key));
        }
        if (lv > 0) {
          icon.addEventListener('contextmenu', e => {
            e.preventDefault();
            socketCtrl.applyBonusDowngrade(name, key);
          });
        }
      });
    }
  }

  /* ── Storage ──────────────────────────────────────────────────────────────── */
  function renderTabStorage(name, room, interactive) {
    const isHq  = name === room.hqTerritory;
    const upg   = (room.territoryUpgrades && room.territoryUpgrades[name]) || {};
    const emSl  = parseInt(upg.largerEmeraldStorage || 0);
    const rsSl  = parseInt(upg.largerResourceStorage || 0);
    const store = (room.perTerritoryStorage && room.perTerritoryStorage[name]) || {};
    let html = '';
    if (isHq) {
      html += '<div class="mc-label" style="margin-bottom:8px;">📦 HQ Bank</div>';
      [['emeralds','💰'],['wood','🪵'],['ore','⛏'],['crops','🌾'],['fish','🐟']].forEach(([k,ico]) => {
        const val = store[k] || 0;
        const cap = hqCap(upg, k);
        const pct = Math.min(100, cap ? (val / cap) * 100 : 0);
        const fcls = val > cap ? 'danger' : pct > 75 ? 'warn' : '';
        html += `<div class="hq-res-bar">
          <div class="hq-res-lbl"><span>${ico} ${k}</span><span class="${val>cap?'over':''}">${fmt(val)} / ${fmt(cap)}</span></div>
          <div class="mc-bar-bg"><div class="mc-bar-fill ${fcls}" style="width:${pct}%;"></div></div>
        </div>`;
      });
    } else {
      html += `<div class="passthrough-box">📦 Non-HQ Territory<br>Resources pass through freely toward HQ each tick.</div>`;
      Object.keys(store).filter(k => (store[k] || 0) > 0).forEach(k => {
        html += `<div class="mc-small">${k}: ${fmt(store[k])}</div>`;
      });
    }

    // Larger Emerald Storage (hourly drain)
    const emMaxed = emSl >= 11;
    const emDrain = EMERALD_STORAGE_COSTS_WOOD[emSl] || 0;
    const emNextDrain = emMaxed ? 0 : (EMERALD_STORAGE_COSTS_WOOD[emSl + 1] || 0);
    html += `<div style="margin-top:10px;"><div class="upg-lv" style="display:flex;justify-content:space-between;align-items:center;">
      <span class="lv-badge${emMaxed?' maxed':''}" style="font-size:12px;">Em Storage Lv ${emSl}/11</span>
      ${emSl > 0 ? `<span style="font-size:11px;color:#c87020;">Drain: ${fmt(emDrain)}/hr wood</span>` : ''}
    </div>
    ${!emMaxed ? `<div style="font-size:10px;color:#8ab573;text-align:right;margin-bottom:2px;">Next lv drain: ${fmt(emNextDrain)}/hr wood</div>` : '<div style="font-size:10px;color:#3a7020;text-align:right;">MAX</div>'}
    <div class="seg-bar">${Array.from({length:11},(_,i)=>`<span class="${i<emSl?'on'+(emMaxed?' maxed':''):''}"></span>`).join('')}</div>`;
    if (interactive && !emMaxed && isHq) html += `<button class="mc-btn upg-btn-em" data-cat="largerEmeraldStorage" style="width:100%;margin-top:4px;font-size:14px;padding:3px 0;">UPGRADE (Wood)</button>`;
    html += '</div>';

    // Larger Resource Storage (hourly drain)
    const rsMaxed = rsSl >= 11;
    const rsDrain = RESOURCE_STORAGE_COSTS_EM[rsSl] || 0;
    const rsNextDrain = rsMaxed ? 0 : (RESOURCE_STORAGE_COSTS_EM[rsSl + 1] || 0);
    html += `<div style="margin-top:10px;"><div class="upg-lv" style="display:flex;justify-content:space-between;align-items:center;">
      <span class="lv-badge${rsMaxed?' maxed':''}" style="font-size:12px;">Res Storage Lv ${rsSl}/11</span>
      ${rsSl > 0 ? `<span style="font-size:11px;color:#c87020;">Drain: ${fmt(rsDrain)}/hr emeralds</span>` : ''}
    </div>
    ${!rsMaxed ? `<div style="font-size:10px;color:#8ab573;text-align:right;margin-bottom:2px;">Next lv drain: ${fmt(rsNextDrain)}/hr emeralds</div>` : '<div style="font-size:10px;color:#3a7020;text-align:right;">MAX</div>'}
    <div class="seg-bar">${Array.from({length:11},(_,i)=>`<span class="${i<rsSl?'on'+(rsMaxed?' maxed':''):''}"></span>`).join('')}</div>`;
    if (interactive && !rsMaxed && isHq) html += `<button class="mc-btn upg-btn-rs" data-cat="largerResourceStorage" style="width:100%;margin-top:4px;font-size:14px;padding:3px 0;">UPGRADE (Emeralds)</button>`;
    html += '</div>';

    if (!isHq && interactive) html += `<button id="makeHqBtn" class="mc-btn blue" style="width:100%;margin-top:12px;font-size:18px;">👑 Set as HQ</button>`;

    E.tMenuBody.innerHTML = html;
    const btnEm = E.tMenuBody.querySelector('.upg-btn-em');
    if (btnEm) btnEm.addEventListener('click', () => socketCtrl.applyStorageUpgrade(name, 'largerEmeraldStorage'));
    const btnRs = E.tMenuBody.querySelector('.upg-btn-rs');
    if (btnRs) btnRs.addEventListener('click', () => socketCtrl.applyStorageUpgrade(name, 'largerResourceStorage'));
    const hqb = E.tMenuBody.querySelector('#makeHqBtn');
    if (hqb) hqb.addEventListener('click', () => socketCtrl.setHqTerritory(name));
  }

  /* ── Tax & Route ──────────────────────────────────────────────────────────── */
  function renderTabTax(name, room, interactive) {
    const tax   = (room.territoryTaxRates && room.territoryTaxRates[name]) || { enemy: 0.30, ally: 0.10 };
    const routeM = (room.territoryRouteMode && room.territoryRouteMode[name]) || 'fastest';
    const hq    = room.hqTerritory || '';
    const selected = room.selectedTerritories || [];
    const adj   = buildAdjacency(selected);
    const path  = bfsHq(name, hq, adj);
    const hops  = path ? path.length - 1 : '?';
    let html = `<div class="mc-label" style="margin-bottom:6px;">Routing Mode</div>
    <div class="route-toggle">
      <button class="mc-btn${routeM==='fastest'?' green':''} route-btn" data-mode="fastest" style="flex:1;">⚡ Fastest</button>
      <button class="mc-btn${routeM==='cheapest'?' green':''} route-btn" data-mode="cheapest" style="flex:1;">💰 Cheapest</button>
    </div>
    <div class="route-preview">
      Route to HQ: ${path ? path.join(' → ') : '<span style="color:#cc3333;">No route</span>'}
      ${path ? `<br><span class="mc-small">Hops: ${hops}</span>` : ''}
    </div>
    <div style="margin-top:12px;">
      <div class="mc-label" style="margin-bottom:8px;">Tax Rates (display)</div>
      <div class="tax-row"><div class="tax-lbl">Enemy: <span id="eTaxLbl">${Math.round(tax.enemy*100)}%</span></div>
        <input type="range" class="tax-slider" id="eTaxSlider" min="5" max="40" value="${Math.round(tax.enemy*100)}" ${!interactive?'disabled':''}></div>
      <div class="tax-row"><div class="tax-lbl">Ally: <span id="aTaxLbl">${Math.round(tax.ally*100)}%</span></div>
        <input type="range" class="tax-slider" id="aTaxSlider" min="5" max="40" value="${Math.round(tax.ally*100)}" ${!interactive?'disabled':''}></div>
      ${interactive ? '<button id="saveTaxBtn" class="mc-btn green" style="width:100%;font-size:16px;margin-top:6px;">💾 Save</button>' : ''}
    </div>`;
    E.tMenuBody.innerHTML = html;
    E.tMenuBody.querySelectorAll('.route-btn').forEach(btn => {
      btn.addEventListener('click', function () { if (interactive) socketCtrl.setRouteMode(name, this.dataset.mode); });
    });
    const es = E.tMenuBody.querySelector('#eTaxSlider'), as = E.tMenuBody.querySelector('#aTaxSlider');
    const el = E.tMenuBody.querySelector('#eTaxLbl'),   al = E.tMenuBody.querySelector('#aTaxLbl');
    if (es) es.addEventListener('input', function () { el.textContent = this.value + '%'; });
    if (as) as.addEventListener('input', function () { al.textContent = this.value + '%'; });
    const sb = E.tMenuBody.querySelector('#saveTaxBtn');
    if (sb) sb.addEventListener('click', () => socketCtrl.setTaxRate(name, parseFloat(es.value)/100, parseFloat(as.value)/100));
  }

  /* ── Info ─────────────────────────────────────────────────────────────────── */
  function renderTabInfo(name, room) {
    const t    = state.territoryByName.get(name);
    const isHq = name === room.hqTerritory;
    const upg  = (room.territoryUpgrades && room.territoryUpgrades[name]) || {};
    const bon  = (room.territoryBonuses  && room.territoryBonuses[name])  || {};
    const held = room.territoryHeldSince && room.territoryHeldSince[name];
    const sel  = room.selectedTerritories || [];
    const selSt = new Set(sel);
    const routes = t ? t.tradeRoutes : [];
    const conns  = routes.filter(r => r !== name && selSt.has(r)).length;
    
    let treaPct = 0;
    let treaLabel = '0% (<1 hour)';
    if (held) {
      const ms = Date.now() - held;
      for (let i = TREASURY_TIER_MS.length - 1; i >= 0; i--) {
        if (ms >= TREASURY_TIER_MS[i]) {
          treaPct = TREASURY_TIER_BONUS[i] * 100;
          treaLabel = TREASURY_TIER_LABELS[i];
          break;
        }
      }
    }
    
    // Eco Mults
    const emProdBonus = ((bon.efficientEmeralds||0)*0.10) + ((bon.emeraldRate||0)*0.10);
    const rsProdBonus = ((bon.efficientResources||0)*0.10) + ((bon.resourceRate||0)*0.10);
    const resMult = 1 + (treaPct/100) + rsProdBonus;
    const emMult  = 1 + (treaPct/100) + emProdBonus;

    // Stat estimations
    const hlv = parseInt(upg.health || 0); const dlv = parseInt(upg.defense || 0); const dmlv = parseInt(upg.damage || 0);
    const baseHp = Math.floor(1000000 * (1 + hlv * 0.25) * (1 + 0.3 * conns));
    const ehp = Math.floor(baseHp / (1 - Math.min(0.80, dlv * 0.05)));
    const baseDps = Math.floor(500000 * (1 + dmlv * 0.25) * (1 + 0.3 * conns));

    const icons = { emeralds:'💰', wood:'🪵', ore:'⛏', crops:'🌾', fish:'🐟' };
    let html = `
      <div class="info-row"><span class="info-key">📍 Territory</span><span class="info-val">${name}</span></div>
      ${isHq?'<div class="info-row"><span class="info-key">👑 Status</span><span class="info-val">Guild HQ</span></div>':''}
      <div class="info-row"><span class="info-key">⏱ Treasury Bonus</span><span class="info-val"><span class="treasury-badge">+${treaPct}%</span> <span style="font-size:12px;color:#888;">(${treaLabel})</span></span></div>
      <div class="info-row" style="margin-top:2px;"><span class="info-key">Territory Held Since</span><span class="info-val" style="font-size:12px;">${held ? new Date(held).toLocaleTimeString() : 'N/A'}</span></div>
      
      <div class="info-divider"></div>
      <div class="mc-label" style="margin-bottom:6px;">Combat Stats</div>
      <div class="info-row"><span class="info-key">🔗 Connections</span><span class="info-val">${conns} (×${(1+0.3*conns).toFixed(2)} Multiplier)</span></div>
      <div class="info-row"><span class="info-key">🛡 Tower HP</span><span class="info-val">${fmt(baseHp)}</span></div>
      <div class="info-row"><span class="info-key">🛡 Effective HP</span><span class="info-val" style="color:#a8dd55;">${fmt(ehp)}</span></div>
      <div class="info-row"><span class="info-key">⚔ Tower DPS</span><span class="info-val" style="color:#dd6655;">${fmt(baseDps)}</span></div>

      <div class="info-divider"></div>
      <div class="mc-label" style="margin-bottom:6px;">Production / tick</div>`;
    if (t) {
      Object.entries(t.resources).forEach(([k, base]) => {
        if (!base) return;
        const mult = k === 'emeralds' ? emMult : resMult;
        html += `<div class="info-row"><span class="info-key">${icons[k]} ${k}</span><span class="info-val">${fmt(base)} → ${fmt(Math.floor(base*mult))}</span></div>`;
      });
    }
    const upgr = ['damage','attackSpeed','health','defense','largerEmeraldStorage','largerResourceStorage'].filter(c => upg[c]);
    const bonr = Object.keys(BONUS_DEFS).filter(k => bon[k]);
    if (upgr.length || bonr.length) {
      html += `<div class="info-divider"></div><div class="mc-label" style="margin-bottom:6px;">Active Upgrades & Bonuses</div>`;
      upgr.forEach(c => {
        const lbl = c === 'largerEmeraldStorage' ? 'Em. Storage' : c === 'largerResourceStorage' ? 'Res. Storage' : UPGRADE_LABEL[c];
        const ico = c.includes('Storage') ? '📦' : UPGRADE_ICON[c];
        html += `<div class="info-row"><span class="info-key">${ico} ${lbl}</span><span class="info-val">Lv${upg[c]}/11</span></div>`;
      });
      bonr.forEach(k => {
        const d = BONUS_DEFS[k];
        html += `<div class="info-row"><span class="info-key">${d.icon} ${d.label}</span><span class="info-val">Lv${bon[k]}/${d.maxLevel}</span></div>`;
      });
    }
    E.tMenuBody.innerHTML = html;
  }

  /* ── Cost & Output ─────────────────────────────────────────────────────── */
  function renderTabCostOutput(name, room, interactive) {
    const t   = state.territoryByName.get(name);
    const upg = (room.territoryUpgrades && room.territoryUpgrades[name]) || {};
    const bon = (room.territoryBonuses  && room.territoryBonuses[name])  || {};
    const icons = { emeralds:'💰', wood:'🪵', ore:'⛏', crops:'🌾', fish:'🐟' };
    let totalCost = 0, totalOutput = 0;
    // Upgrade drains
    ['damage','attackSpeed','health','defense'].forEach(cat => {
      const lv = parseInt(upg[cat] || 0);
      totalCost += UPGRADE_COSTS_PER_LEVEL[lv] || 0;
    });
    // Bonus drains
    Object.keys(BONUS_DEFS).forEach(key => {
      const lv = parseInt(bon[key] || 0);
      totalCost += BONUS_DEFS[key].costs[lv] || 0;
    });
    // Production output
    const emProdBonus = ((bon.efficientEmeralds||0)*0.10) + ((bon.emeraldRate||0)*0.10);
    const rsProdBonus = ((bon.efficientResources||0)*0.10) + ((bon.resourceRate||0)*0.10);
    let outputRows = '';
    if (t) {
      Object.entries(t.resources).forEach(([k, base]) => {
        if (!base) return;
        const mult = k === 'emeralds' ? 1 + emProdBonus : 1 + rsProdBonus;
        const prod = Math.floor(base * mult);
        totalOutput += prod;
        outputRows += `<div class="info-row"><span class="info-key">${icons[k]} ${k}</span><span class="info-val">+${fmt(prod)}/hr</span></div>`;
      });
    }
    const net = totalOutput - totalCost;
    const netColor = net >= 0 ? '#2a6a20' : '#cc2222';
    let html = `<div class="mc-label" style="margin-bottom:8px;">📊 Hourly Summary</div>
      <div style="background:#b8a870;border:2px solid #9a8558;padding:8px;margin-bottom:8px;">
        <div class="info-row"><span class="info-key">🔴 Total Cost</span><span class="info-val" style="color:#cc3333;">-${fmt(totalCost)}/hr</span></div>
        <div class="info-row"><span class="info-key">🟢 Total Output</span><span class="info-val" style="color:#2a6a20;">+${fmt(totalOutput)}/hr</span></div>
        <div style="height:1px;background:#9a8558;margin:6px 0;"></div>
        <div class="info-row"><span class="info-key" style="font-size:20px;">NET</span><span class="info-val" style="font-size:20px;color:${netColor};">${net>=0?'+':''}${fmt(net)}/hr</span></div>
      </div>
      <div class="mc-label" style="margin-bottom:6px;">Production Breakdown</div>
      ${outputRows || '<div class="mc-small">No resources produced here.</div>'}`;
    E.tMenuBody.innerHTML = html;
  }

  /* ── Trade Route ────────────────────────────────────────────────────────── */
  function renderTabTradeRoute(name, room, interactive) {
    const routeM = (room.territoryRouteMode && room.territoryRouteMode[name]) || 'fastest';
    const hq     = room.hqTerritory || '';
    const selected = room.selectedTerritories || [];
    const adj    = buildAdjacency(selected);
    const path   = bfsHq(name, hq, adj);
    const hops   = path ? path.length - 1 : '?';
    let html = `<div class="mc-label" style="margin-bottom:6px;">Route to HQ (${hq || 'none'})</div>
      <div class="route-toggle">
        <button class="mc-btn${routeM==='fastest'?' green':''} route-btn" data-mode="fastest" style="flex:1;">⚡ Fastest</button>
        <button class="mc-btn${routeM==='cheapest'?' green':''} route-btn" data-mode="cheapest" style="flex:1;">💰 Cheapest</button>
      </div>
      <div class="route-preview" style="margin-top:8px;">
        ${path ? path.map((p,i) => i===0 ? `<b style="color:#005500;">${p} 👑</b>` : `<span style="color:#5a3820;">→ ${p}</span>`).join(' ') : '<span style="color:#cc3333;">⚠ No route to HQ</span>'}
        ${path ? `<br><span class="mc-small">Hops: ${hops} | Mode: ${routeM}</span>` : ''}
      </div>`;
    E.tMenuBody.innerHTML = html;
    E.tMenuBody.querySelectorAll('.route-btn').forEach(btn => {
      btn.addEventListener('click', function () { if (interactive) socketCtrl.setRouteMode(name, this.dataset.mode); });
    });
  }

  /* ── Set HQ ─────────────────────────────────────────────────────────────── */
  function renderTabSetHq(name, room, interactive) {
    const isHq = name === room.hqTerritory;
    let html = `<div style="text-align:center;padding:16px;">
      <div style="font-size:48px;margin-bottom:10px;">${isHq ? '👑' : '🏠'}</div>
      <div class="mc-title" style="margin-bottom:8px;">${isHq ? 'This IS your Guild HQ' : 'Set as Guild HQ'}</div>`;
    if (isHq) {
      html += `<div class="mc-label" style="color:#2a6a20;">✅ ${name} is currently the HQ territory.</div>
        <div class="mc-small" style="margin-top:8px;">All resources flow here. Storage caps apply here.</div>`;
    } else if (interactive) {
      html += `<div class="mc-small" style="margin-bottom:12px;">Moving HQ here will change where resources accumulate.</div>
        <button id="setHqConfirmBtn" class="mc-btn blue" style="font-size:22px;padding:10px 30px;">👑 SET AS HQ</button>`;
    } else {
      html += `<div class="mc-small">Only the defender can change HQ during prep/playing.</div>`;
    }
    html += '</div>';
    E.tMenuBody.innerHTML = html;
    const btn = E.tMenuBody.querySelector('#setHqConfirmBtn');
    if (btn) btn.addEventListener('click', () => socketCtrl.setHqTerritory(name));
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
        E.statusText.textContent = '🟢 ' + base.replace('https://','').replace('http://','');
        this.tryResume();
      });
      state.socket.on('disconnect', () => {
        state.connected = false;
        E.statusText.textContent = '🔴 Disconnected';
      });

      state.socket.on('roomState', room => {
        state.currentRoom = room;
        if (!state.role) state.role = inferRole(room);
        state.selectedSet = new Set(room.selectedTerritories || []);
        if (!room.currentAttack && state.attackCdTimer) { clearInterval(state.attackCdTimer); state.attackCdTimer = null; }
        renderSidebar(); updateAllStyles(); renderRoutes(); refreshMenuIfOpen();
      });

      state.socket.on('tick:update', payload => {
        const res = payload.defenderResources || {};
        E.resEm.textContent = fmt(res.emeralds);
        E.resWo.textContent = fmt(res.wood);
        E.resOr.textContent = fmt(res.ore);
        E.resCr.textContent = fmt(res.crops);
        E.resFi.textContent = fmt(res.fish);
        const msgs = payload.messages || [];
        E.tickMsgs.innerHTML = msgs.slice(0,8).map(m => `<li style="font-size:11px;color:#f8d9a7;">${m}</li>`).join('');
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
        renderSidebar();
      });

      state.socket.on('statusChanged', ({ status }) => {
        if (state.currentRoom) state.currentRoom.status = status;
        if (status === 'lobby' && state.attackCdTimer) { clearInterval(state.attackCdTimer); state.attackCdTimer = null; }
        renderSidebar();
      });

      // Server emitted when prep ends → playing begins (no auto-war)
      state.socket.on('playing:started', payload => {
        if (state.role === 'attacker' && E.attackStatusBar) {
          E.attackStatusBar.style.display = 'block';
          E.attackStatusBar.innerHTML = `<div style="font-family:VT323,monospace;font-size:15px;color:#88ff88;">${payload.message || 'Prep complete! Choose a territory to attack.'}</div>`;
        }
        renderSidebar();
      });

      state.socket.on('war:estimates', payload => {
        state.warEstimates = payload;
        renderSidebar();
      });

      // ── Attack flow events ─────────────────────────────────────────────────
      state.socket.on('attack:queued', payload => {
        if (state.currentRoom) {
          state.currentRoom.currentAttack = {
            territory: payload.territory, phase: 'queue',
            queueEndsAt: payload.queueEndsAt, battleEndsAt: payload.battleEndsAt
          };
        }
        playSfx('warn'); updateAllStyles(); renderSidebar();
      });

      state.socket.on('attack:battle', payload => {
        if (state.currentRoom && state.currentRoom.currentAttack) {
          state.currentRoom.currentAttack.phase = 'battle';
        }
        playSfx('warn'); updateAllStyles(); renderSidebar();
      });

      state.socket.on('attack:captured', ({ territory }) => {
        if (state.currentRoom) {
          state.currentRoom.selectedTerritories =
            (state.currentRoom.selectedTerritories || []).filter(t => t !== territory);
          if (!state.currentRoom.attackerCapturedTerritories)
            state.currentRoom.attackerCapturedTerritories = [];
          state.currentRoom.attackerCapturedTerritories.push(territory);
          state.currentRoom.currentAttack = null;
          state.selectedSet.delete(territory);
        }
        playSfx('success'); updateAllStyles(); renderRoutes(); renderSidebar();
      });

      state.socket.on('war:ended', ({ result, capturedTerritory, warTowerStats }) => {
        showWarResult(result, capturedTerritory, warTowerStats);
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
        if (res && res.ok) { state.role = res.role; }
        else clearSession();
      });
    },

    createRoom() {
      if (!state.connected) { alert('Not connected.'); return; }
      state.socket.emit('createRoom', null, res => {
        if (res && res.ok) {
          state.role = 'defender';
          saveSession({ roomId: res.roomId, playerToken: res.playerToken, role: 'defender' });
        } else alert(res && res.error ? res.error : 'Could not create room.');
      });
    },

    joinRoom(code) {
      if (!state.connected || !/^\d{6}$/.test(code)) { alert('Enter a valid 6-digit room code.'); return; }
      state.socket.emit('joinRoom', { roomId: code }, res => {
        if (res && res.ok) {
          state.role = 'attacker';
          saveSession({ roomId: res.roomId, playerToken: res.playerToken, role: 'attacker' });
        } else alert(res && res.error ? res.error : 'Could not join.');
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
        if (res && res.ok && res.estimates) {
          state.warEstimates = { towerStats: state.warEstimates && state.warEstimates.towerStats, estimates: res.estimates };
        }
      });
    },

    applyStorageUpgrade(terrName, category) {
      if (!state.socket) return;
      state.socket.emit('storage:apply', { territoryName: terrName, category }, res => {
        if (res && !res.ok) alert(res.error || 'Storage upgrade failed.');
      });
    },

    applyDowngrade(terrName, category) {
      if (!state.socket) return;
      state.socket.emit('upgrade:downgrade', { territoryName: terrName, category }, res => {
        if (res && !res.ok) alert(res.error || 'Downgrade failed.');
      });
    },

    applyBonusDowngrade(terrName, bonusKey) {
      if (!state.socket) return;
      state.socket.emit('bonus:downgrade', { territoryName: terrName, bonusKey }, res => {
        if (res && !res.ok) alert(res.error || 'Downgrade failed.');
      });
    },

    startAttack(territoryName) {
      if (!state.socket) return;
      state.socket.emit('attacker:attack', { territoryName }, res => {
        if (res && !res.ok) alert('Attack failed: ' + (res.error || '?'));
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
  if (E.tMenuSelect) E.tMenuSelect.addEventListener('change', function () {
    state.activeMenu = this.value; renderMenuContent();
  });
  if (E.tMenuCloseBtn) E.tMenuCloseBtn.addEventListener('click', closeMenu);
  if (E.tMenuOverlay) E.tMenuOverlay.addEventListener('click', e => { if (e.target === E.tMenuOverlay) closeMenu(); });

  // Attack overlay
  if (E.attackCloseBtn) E.attackCloseBtn.addEventListener('click', () => { if (E.attackOverlay) E.attackOverlay.style.display = 'none'; });
  if (E.attackOverlay)  E.attackOverlay.addEventListener('click', e => { if (e.target === E.attackOverlay) E.attackOverlay.style.display = 'none'; });

  // War result
  if (E.warResultClose) E.warResultClose.addEventListener('click', () => { E.warResultOver.style.display = 'none'; });

  // ─── Boot ────────────────────────────────────────────────────────────────────
  initMap()
    .then(() => socketCtrl.connect())
    .catch(e => console.error('Boot failed', e));
})();
