(function () {
  const STATIC_TERRITORIES_URL =
    'https://raw.githubusercontent.com/jakematt123/Wynncraft-Territory-Info/main/territories.json';
  const MAP_IMAGE_URL = './main-map.webp';
  const MAP_X_MIN = -2500;
  const MAP_X_MAX = 2500;
  const MAP_Z_MIN = -6635;
  const MAP_Z_MAX = 0;
  const MAP_OFFSET_X_PX = 75;
  const MAP_OFFSET_Y_PX = -15;
  const MAP_SCALE_X = 1;
  const MAP_SCALE_Y = 1;
  const MAP_BG_SCALE_X = 0.803;
  const MAP_BG_SCALE_Y = 0.966;
  const SOCKET_DEV_PORT = 3001;
  const ECO_WAR_SESSION_KEY_PREFIX = 'ecoWarRoomSessionV1';
  const FLIP_Z = true;
  const UPGRADE_COSTS = {
    damage: [0, 50, 120, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000],
    attackSpeed: [0, 40, 100, 220, 400, 650, 950, 1350, 1800, 2400, 3100, 3900],
    health: [0, 60, 140, 280, 500, 780, 1100, 1550, 2100, 2800, 3600, 4500],
    defense: [0, 30, 80, 170, 320, 520, 780, 1100, 1500, 2000, 2600, 3300]
  };
  const STORAGE_COSTS = {
    emeralds: [0, 300, 650, 1100, 1700, 2500, 3500, 4700, 6200, 8000, 10100, 12500],
    wood: [0, 100, 220, 400, 650, 950, 1350, 1850, 2500, 3300, 4300, 5500]
  };
  const UPGRADE_RESOURCE_BY_CATEGORY = {
    damage: 'ore',
    attackSpeed: 'crops',
    health: 'wood',
    defense: 'fish',
    storage: 'wood'
  };
  const PRODUCTION_MULT_MIN = 0.5;
  const PRODUCTION_MULT_MAX = 1.5;

  const state = {
    map: null,
    geo: null,
    territoryByName: new Map(),
    layerByName: new Map(),
    routeLayer: null,
    hqMarker: null,
    selectedTerritories: new Set(),
    socket: null,
    currentRoom: null,
    role: null,
    connected: false,
    armedForDefenderCreate: false,
    lastTickPayload: null,
    tickCountdownTimer: null,
    selectedUpgradeTerritory: '',
    upgradeNotices: [],
    sfxEnabled: true,
    socketBase: '',
    resumeInFlight: false
  };

  const els = {
    createGameBtn: document.getElementById('createGameBtn'),
    joinCodeInput: document.getElementById('joinCodeInput'),
    joinGameBtn: document.getElementById('joinGameBtn'),
    statusText: document.getElementById('statusText'),
    lobbyOverlay: document.getElementById('lobbyOverlay'),
    roomCodeText: document.getElementById('roomCodeText'),
    copyCodeBtn: document.getElementById('copyCodeBtn'),
    roleText: document.getElementById('roleText'),
    gameStatusText: document.getElementById('gameStatusText'),
    countdownText: document.getElementById('countdownText'),
    readyStateText: document.getElementById('readyStateText'),
    selectionCountText: document.getElementById('selectionCountText'),
    tickIntervalText: document.getElementById('tickIntervalText'),
    routeModeRow: document.getElementById('routeModeRow'),
    productionBuffRow: document.getElementById('productionBuffRow'),
    productionMultText: document.getElementById('productionMultText'),
    prodMultDownBtn: document.getElementById('prodMultDownBtn'),
    prodMultUpBtn: document.getElementById('prodMultUpBtn'),
    territoryList: document.getElementById('territoryList'),
    readyBtn: document.getElementById('readyBtn'),
    resourcesPanel: document.getElementById('resourcesPanel'),
    resEmeralds: document.getElementById('resEmeralds'),
    resWood: document.getElementById('resWood'),
    resOre: document.getElementById('resOre'),
    resCrops: document.getElementById('resCrops'),
    resFish: document.getElementById('resFish'),
    tickCountdownText: document.getElementById('tickCountdownText'),
    tickMessages: document.getElementById('tickMessages'),
    upgradeMenuBtn: document.getElementById('upgradeMenuBtn'),
    upgradeModal: document.getElementById('upgradeModal'),
    upgradeModalCloseBtn: document.getElementById('upgradeModalCloseBtn'),
    upgradeTerritorySelect: document.getElementById('upgradeTerritorySelect'),
    hqTerritorySelect: document.getElementById('hqTerritorySelect'),
    setHqBtn: document.getElementById('setHqBtn'),
    upgradeRoleHint: document.getElementById('upgradeRoleHint'),
    upgradeDamageMeta: document.getElementById('upgradeDamageMeta'),
    upgradeAttackSpeedMeta: document.getElementById('upgradeAttackSpeedMeta'),
    upgradeHealthMeta: document.getElementById('upgradeHealthMeta'),
    upgradeDefenseMeta: document.getElementById('upgradeDefenseMeta'),
    upgradeStorageMeta: document.getElementById('upgradeStorageMeta'),
    upgradeDamageBtn: document.getElementById('upgradeDamageBtn'),
    upgradeAttackSpeedBtn: document.getElementById('upgradeAttackSpeedBtn'),
    upgradeHealthBtn: document.getElementById('upgradeHealthBtn'),
    upgradeDefenseBtn: document.getElementById('upgradeDefenseBtn'),
    upgradeStorageBtn: document.getElementById('upgradeStorageBtn'),
    upgradeNoticeList: document.getElementById('upgradeNoticeList'),
    upgradeReadOnlyPanel: document.getElementById('upgradeReadOnlyPanel'),
    upgradeReadOnlyList: document.getElementById('upgradeReadOnlyList'),
    upgradeSfxToggleBtn: document.getElementById('upgradeSfxToggleBtn'),
    upgradeDamageCard: document.getElementById('upgradeDamageCard'),
    upgradeAttackSpeedCard: document.getElementById('upgradeAttackSpeedCard'),
    upgradeHealthCard: document.getElementById('upgradeHealthCard'),
    upgradeDefenseCard: document.getElementById('upgradeDefenseCard'),
    upgradeStorageCard: document.getElementById('upgradeStorageCard'),
    upgradeDamageBadge: document.getElementById('upgradeDamageBadge'),
    upgradeAttackSpeedBadge: document.getElementById('upgradeAttackSpeedBadge'),
    upgradeHealthBadge: document.getElementById('upgradeHealthBadge'),
    upgradeDefenseBadge: document.getElementById('upgradeDefenseBadge'),
    upgradeStorageBadge: document.getElementById('upgradeStorageBadge'),
    upgradeDamageBar: document.getElementById('upgradeDamageBar'),
    upgradeAttackSpeedBar: document.getElementById('upgradeAttackSpeedBar'),
    upgradeHealthBar: document.getElementById('upgradeHealthBar'),
    upgradeDefenseBar: document.getElementById('upgradeDefenseBar'),
    upgradeStorageBar: document.getElementById('upgradeStorageBar')
  };

  function fmt(value) {
    return (Number(value) || 0).toLocaleString();
  }

  function nowStamp() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function pushUpgradeNotice(text) {
    state.upgradeNotices.unshift('[' + nowStamp() + '] ' + text);
    if (state.upgradeNotices.length > 20) {
      state.upgradeNotices = state.upgradeNotices.slice(0, 20);
    }
  }

  function renderSegBar(container, level, maxed) {
    if (!container) return;
    container.classList.toggle('maxed', !!maxed);
    container.innerHTML = '';
    for (let i = 0; i < 11; i++) {
      const seg = document.createElement('span');
      if (i < level) seg.classList.add('on');
      container.appendChild(seg);
    }
  }

  function setSfxEnabled(enabled) {
    state.sfxEnabled = !!enabled;
    try {
      localStorage.setItem('warSfxEnabled', state.sfxEnabled ? '1' : '0');
    } catch (_e) {}
    if (els.upgradeSfxToggleBtn) {
      els.upgradeSfxToggleBtn.textContent = 'SFX: ' + (state.sfxEnabled ? 'ON' : 'OFF');
    }
  }

  function playSfx(kind) {
    if (!state.sfxEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = kind === 'success' ? 720 : 220;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
      osc.onended = function () {
        ctx.close();
      };
    } catch (_e) {}
  }

  function stopTickCountdownTimer() {
    if (state.tickCountdownTimer) {
      clearInterval(state.tickCountdownTimer);
      state.tickCountdownTimer = null;
    }
  }

  function startTickCountdownTimer(nextTickInMs) {
    stopTickCountdownTimer();
    const endsAt = Date.now() + (nextTickInMs || 0);
    function paint() {
      const msLeft = Math.max(0, endsAt - Date.now());
      const secLeft = Math.ceil(msLeft / 1000);
      els.tickCountdownText.textContent = 'Next tick in: ' + secLeft + 's';
      if (msLeft <= 0) {
        stopTickCountdownTimer();
      }
    }
    paint();
    state.tickCountdownTimer = setInterval(paint, 250);
  }

  /**
   * @param {object} row
   * @returns {string[]}
   */
  function readTradeRoutes(row) {
    const tr = row['Trading Routes'] || row.tradingRoutes || row.trade_routes;
    return Array.isArray(tr) ? tr.map(String) : [];
  }

  const territoryDataAdapter = {
    async loadStatic() {
      const res = await fetch(STATIC_TERRITORIES_URL);
      if (!res.ok) throw new Error('Failed to load static territory data');
      return res.json();
    },
    parseTerritories(staticData) {
      const list = [];
      Object.keys(staticData).forEach(function (name) {
        const row = staticData[name] || {};
        const loc = row.Location || row.location;
        const tradeRoutes = readTradeRoutes(row);
        if (!loc || !loc.start || !loc.end) return;
        const x1 = loc.start[0];
        const z1 = loc.start[1];
        const x2 = loc.end[0];
        const z2 = loc.end[1];
        list.push({
          name,
          minX: Math.min(x1, x2),
          maxX: Math.max(x1, x2),
          minZ: Math.min(z1, z2),
          maxZ: Math.max(z1, z2),
          guildName: '',
          tradeRoutes
        });
      });
      return list;
    }
  };

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * @param {number} imgW
   * @param {number} imgH
   * @returns {object} Leaflet LatLngBounds
   */
  function getImageOverlayBounds(imgW, imgH) {
    const scaledW = imgW * MAP_BG_SCALE_X;
    const scaledH = imgH * MAP_BG_SCALE_Y;
    const minLng = (imgW - scaledW) / 2;
    const maxLng = minLng + scaledW;
    const minLat = (imgH - scaledH) / 2;
    const maxLat = minLat + scaledH;
    return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
  }

  function applyLiveOwnership() {
    state.territoryByName.forEach(function (t) {
      t.guildName = '';
    });
    renderSelectionLocally();
  }

  function worldToLayer(x, z) {
    const imgW = state.geo.imgW;
    const imgH = state.geo.imgH;
    const westSpan = Math.abs(MAP_X_MIN) || 1;
    const eastSpan = Math.abs(MAP_X_MAX) || 1;
    const northSpan = Math.abs(MAP_Z_MIN) || 1;
    const southSpan = Math.abs(MAP_Z_MAX) || 1;

    let nx = 0.5;
    if (x < 0) nx = 0.5 - 0.5 * (Math.abs(x) / westSpan);
    else nx = 0.5 + 0.5 * (Math.abs(x) / eastSpan);

    let ny = 1;
    if (z <= 0) ny = 1 - (Math.abs(z) / northSpan);
    else ny = 1 + (Math.abs(z) / southSpan);

    nx = clamp01(nx);
    ny = clamp01(ny);
    if (FLIP_Z) ny = 1 - ny;

    const scaledNx = 0.5 + (nx - 0.5) * MAP_SCALE_X;
    const scaledNy = 0.5 + (ny - 0.5) * MAP_SCALE_Y;
    return L.latLng(
      scaledNy * imgH + MAP_OFFSET_Y_PX,
      scaledNx * imgW + MAP_OFFSET_X_PX
    );
  }

  function boundsFromWorldRect(t) {
    const corners = [
      worldToLayer(t.minX, t.minZ),
      worldToLayer(t.maxX, t.minZ),
      worldToLayer(t.maxX, t.maxZ),
      worldToLayer(t.minX, t.maxZ)
    ];
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    corners.forEach(function (c) {
      minLat = Math.min(minLat, c.lat);
      maxLat = Math.max(maxLat, c.lat);
      minLng = Math.min(minLng, c.lng);
      maxLng = Math.max(maxLng, c.lng);
    });
    return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
  }

  function selectedArray() {
    return Array.from(state.selectedTerritories);
  }

  function setStatus(text) {
    els.statusText.textContent = text;
  }

  function roomSessionKey() {
    const base = state.socketBase || 'default';
    return ECO_WAR_SESSION_KEY_PREFIX + ':' + base;
  }

  function saveRoomSession(session) {
    try {
      sessionStorage.setItem(roomSessionKey(), JSON.stringify(session));
    } catch (_e) {}
  }

  function loadRoomSession() {
    try {
      const raw = sessionStorage.getItem(roomSessionKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!/^\d{6}$/.test(parsed.roomId || '')) return null;
      if (!parsed.playerToken || typeof parsed.playerToken !== 'string') return null;
      if ((parsed.role !== 'defender' && parsed.role !== 'attacker')) return null;
      return parsed;
    } catch (_e) {
      return null;
    }
  }

  function clearRoomSession() {
    try {
      sessionStorage.removeItem(roomSessionKey());
    } catch (_e) {}
  }

  function inferRoleFromRoom(room) {
    if (!room || !state.socket || !state.socket.id) return null;
    if (room.defenderSocketId === state.socket.id) return 'defender';
    if (room.attackerSocketId === state.socket.id) return 'attacker';
    return null;
  }

  /**
   * Socket.io base URL (where server/proxy.js or equivalent is running).
   * Vercel and similar static hosts do not run Socket.io; set meta or ECO_WAR_SOCKET_URL for production HTTPS.
   * @returns {string | null}
   */
  function getEcoWarSocketBase() {
    try {
      const el = document.querySelector('meta[name="eco-war-socket-url"]');
      if (el && el.content && String(el.content).trim()) {
        return String(el.content).trim().replace(/\/+$/, '');
      }
    } catch (_e) {}
    if (typeof window.ECO_WAR_SOCKET_URL === 'string' && window.ECO_WAR_SOCKET_URL.trim()) {
      return window.ECO_WAR_SOCKET_URL.trim().replace(/\/+$/, '');
    }
    const host = window.location.hostname || '';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
    if (isLocal) {
      return 'http://127.0.0.1:' + SOCKET_DEV_PORT;
    }
    if (window.location.protocol === 'http:') {
      return 'http://' + host + ':' + SOCKET_DEV_PORT;
    }
    return null;
  }

  /**
   * Optional shared token used for privileged room actions when backend enforces it.
   * @returns {string}
   */
  function getEcoWarSharedToken() {
    try {
      const el = document.querySelector('meta[name="eco-war-shared-token"]');
      if (el && el.content && String(el.content).trim()) {
        return String(el.content).trim();
      }
    } catch (_e) {}
    if (typeof window.ECO_WAR_SHARED_TOKEN === 'string' && window.ECO_WAR_SHARED_TOKEN.trim()) {
      return window.ECO_WAR_SHARED_TOKEN.trim();
    }
    return '';
  }

  function styleForTerritoryName(name) {
    const room = state.currentRoom;
    const hq = room && Array.isArray(room.selectedTerritories) && room.selectedTerritories.length
      ? (room.hqTerritory || room.selectedTerritories[0] || '')
      : '';
    const isHq = !!hq && name === hq;
    const selected = state.selectedTerritories.has(name);
    if (selected) {
      if (isHq) {
        return {
          color: '#facc15',
          weight: 3,
          fillColor: '#3b82f6',
          fillOpacity: 0.55,
          opacity: 1
        };
      }
      return {
        color: '#4da3ff',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.5,
        opacity: 1
      };
    }
    if (isHq) {
      return {
        color: '#facc15',
        weight: 2.5,
        fillColor: '#fde68a',
        fillOpacity: 0.3,
        opacity: 0.95
      };
    }
    return {
      color: 'rgba(180, 180, 190, 0.85)',
      weight: 1,
      fillColor: '#f5f5f7',
      fillOpacity: 0.22,
      opacity: 0.85
    };
  }

  function updateLayerStyle(name) {
    const layer = state.layerByName.get(name);
    if (!layer) return;
    layer.setStyle(styleForTerritoryName(name));
  }

  function renderSelectionLocally() {
    state.layerByName.forEach(function (_layer, name) {
      updateLayerStyle(name);
    });
    renderHqMarker();
    renderTradeRoutesOverlay();
    refreshTerritoryTooltips();
  }

  function territoryCenterByName(name) {
    const t = state.territoryByName.get(name);
    if (!t) return null;
    return worldToLayer((t.minX + t.maxX) / 2, (t.minZ + t.maxZ) / 2);
  }

  function getTerritoryStorageRow(name) {
    const room = state.currentRoom || {};
    const all = room.perTerritoryStorage || {};
    return all[name] || null;
  }

  function getStorageCapacity(level, isHq) {
    const base = 500000;
    const multiplier = 1 + (Math.max(0, Math.min(11, Number(level) || 0)) * 0.25);
    const hqMultiplier = isHq ? 10 : 1;
    return Math.floor(base * multiplier * hqMultiplier);
  }

  function getMainResourceKey(name) {
    const territory = state.territoryByName.get(name);
    if (!territory) return 'wood';
    const keys = ['wood', 'ore', 'crops', 'fish'];
    let best = 'wood';
    let bestValue = -1;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const val = Number(territory.resources && territory.resources[key] ? territory.resources[key] : 0);
      if (val > bestValue) {
        bestValue = val;
        best = key;
      }
    }
    return best;
  }

  function territoryTooltipHtml(name) {
    const row = getTerritoryStorageRow(name);
    if (!row) return name;
    const mainKey = getMainResourceKey(name);
    return (
      '<strong>' + name + '</strong><br>' +
      'Emeralds: ' + fmt(row.emeralds) + '<br>' +
      mainKey.charAt(0).toUpperCase() + mainKey.slice(1) + ': ' + fmt(row[mainKey])
    );
  }

  function refreshTerritoryTooltips() {
    state.layerByName.forEach(function (layer, name) {
      if (!layer || !layer.getTooltip || !layer.getTooltip()) return;
      layer.setTooltipContent(territoryTooltipHtml(name));
    });
  }

  function buildSelectedAdjacency(selectedSet) {
    const adjacency = new Map();
    selectedSet.forEach(function (name) {
      adjacency.set(name, new Set());
    });
    selectedSet.forEach(function (fromName) {
      const territory = state.territoryByName.get(fromName);
      const neighbors = territory && Array.isArray(territory.tradeRoutes) ? territory.tradeRoutes : [];
      for (let i = 0; i < neighbors.length; i++) {
        const toName = neighbors[i];
        if (!selectedSet.has(toName)) continue;
        adjacency.get(fromName).add(toName);
        adjacency.get(toName).add(fromName);
      }
    });
    return adjacency;
  }

  function findRouteToHq(fromName, hqName) {
    if (!fromName || !hqName) return null;
    if (fromName === hqName) return [hqName];
    const room = state.currentRoom;
    const selected = room && Array.isArray(room.selectedTerritories) ? room.selectedTerritories : [];
    const selectedSet = new Set(selected);
    if (!selectedSet.has(fromName) || !selectedSet.has(hqName)) return null;
    const adjacency = buildSelectedAdjacency(selectedSet);
    const queue = [fromName];
    const visited = new Set([fromName]);
    const parent = new Map();
    while (queue.length) {
      const current = queue.shift();
      const neighbors = Array.from(adjacency.get(current) || []);
      for (let i = 0; i < neighbors.length; i++) {
        const next = neighbors[i];
        if (visited.has(next)) continue;
        visited.add(next);
        parent.set(next, current);
        if (next === hqName) {
          const path = [hqName];
          let cursor = hqName;
          while (parent.has(cursor)) {
            cursor = parent.get(cursor);
            path.push(cursor);
            if (cursor === fromName) break;
          }
          path.reverse();
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  function renderTradeRoutesOverlay() {
    if (!state.routeLayer) return;
    state.routeLayer.clearLayers();
    const room = state.currentRoom;
    if (!room || !Array.isArray(room.selectedTerritories) || room.selectedTerritories.length === 0) return;
    const hq = room.hqTerritory || room.selectedTerritories[0];
    if (!hq) return;
    const selectedSet = new Set(room.selectedTerritories);
    const pathEdgeKeys = new Set();
    room.selectedTerritories.forEach(function (name) {
      const path = findRouteToHq(name, hq);
      if (!path || path.length < 2) return;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        if (!selectedSet.has(a) || !selectedSet.has(b)) continue;
        const key = a < b ? a + '|' + b : b + '|' + a;
        pathEdgeKeys.add(key);
      }
    });
    const drawn = new Set();
    selectedSet.forEach(function (name) {
      const t = state.territoryByName.get(name);
      if (!t || !Array.isArray(t.tradeRoutes)) return;
      for (let i = 0; i < t.tradeRoutes.length; i++) {
        const other = t.tradeRoutes[i];
        if (!selectedSet.has(other) || !state.territoryByName.has(other)) continue;
        const a = name;
        const b = other;
        const key = a < b ? a + '|' + b : b + '|' + a;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const start = territoryCenterByName(a);
        const end = territoryCenterByName(b);
        if (!start || !end) continue;
        const onHqPath = pathEdgeKeys.has(key);
        L.polyline([start, end], {
          color: onHqPath ? '#ffe08a' : '#8ec5ff',
          weight: onHqPath ? 3 : 2,
          opacity: onHqPath ? 0.95 : 0.55,
          dashArray: onHqPath ? null : '4 4'
        }).addTo(state.routeLayer);
      }
    });
  }

  function ensureHqIcon() {
    return L.divIcon({
      className: 'eco-war-hq-icon',
      html: '<div style="font-size:18px; text-shadow:0 1px 3px #000;">👑</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  function renderHqMarker() {
    const room = state.currentRoom;
    const hq = room && Array.isArray(room.selectedTerritories) && room.selectedTerritories.length
      ? (room.hqTerritory || room.selectedTerritories[0] || '')
      : '';
    if (!hq || !state.map || !state.territoryByName.has(hq)) {
      if (state.hqMarker) {
        state.map.removeLayer(state.hqMarker);
        state.hqMarker = null;
      }
      return;
    }
    const center = territoryCenterByName(hq);
    if (!center) return;
    if (!state.hqMarker) {
      state.hqMarker = L.marker(center, {
        icon: ensureHqIcon(),
        interactive: false,
        keyboard: false
      }).addTo(state.map);
    } else {
      state.hqMarker.setLatLng(center);
    }
  }

  function toggleTerritory(name) {
    if (state.role && state.role !== 'defender') return;
    if (!state.armedForDefenderCreate && !state.currentRoom) return;
    if (state.selectedTerritories.has(name)) state.selectedTerritories.delete(name);
    else state.selectedTerritories.add(name);
    renderSelectionLocally();
    lobbyView.renderSelectionSummary();
    socketController.syncSelectionIfAllowed();
  }

  const selectionController = {
    initMapLayers(territories) {
      territories.forEach(function (t) {
        state.territoryByName.set(t.name, t);
        const b = boundsFromWorldRect(t);
        const layer = L.rectangle(b, styleForTerritoryName(t.name));
        layer.on('click', function () {
          toggleTerritory(t.name);
        });
        layer.bindTooltip(territoryTooltipHtml(t.name), { sticky: true, direction: 'auto' });
        layer.on('mouseover', function () {
          layer.setTooltipContent(territoryTooltipHtml(t.name));
        });
        layer.addTo(state.map);
        state.layerByName.set(t.name, layer);
      });
    },
    applyServerSelection(list) {
      state.selectedTerritories = new Set(Array.isArray(list) ? list : []);
      renderSelectionLocally();
      lobbyView.renderSelectionSummary();
    }
  };

  const lobbyView = {
    renderRoom(room) {
      if (!room) return;
      els.lobbyOverlay.style.display = 'block';
      els.roomCodeText.textContent = room.id || '------';
      els.roleText.textContent = 'Role: ' + (state.role || '-');
      els.gameStatusText.textContent = 'Status: ' + room.status;
      els.readyStateText.textContent =
        'Defender ready: ' + room.defenderReady + ' | Attacker ready: ' + room.attackerReady;
      const tickMs = typeof room.tickIntervalMs === 'number' ? room.tickIntervalMs : 60000;
      if (els.tickIntervalText) {
        els.tickIntervalText.textContent =
          'Resource tick: ' + Math.round(tickMs / 1000) + 's (server)';
      }
      const routeMode = room.routeMode === 'cheapest' ? 'cheapest' : 'fastest';
      const routeInputs = document.querySelectorAll('input[name="routeMode"]');
      for (let ri = 0; ri < routeInputs.length; ri++) {
        const inp = routeInputs[ri];
        inp.checked = inp.value === routeMode;
        inp.disabled = state.role !== 'defender';
      }
      const prodMult = Number(room.productionMultiplier);
      const prodOk = Number.isFinite(prodMult) ? prodMult : 1;
      if (els.productionMultText) {
        els.productionMultText.textContent = Math.round(prodOk * 100) + '%';
      }
      const canEcoSettings = state.role === 'defender' && !!room.id;
      if (els.prodMultDownBtn) {
        els.prodMultDownBtn.disabled = !canEcoSettings || prodOk <= PRODUCTION_MULT_MIN + 0.001;
      }
      if (els.prodMultUpBtn) {
        els.prodMultUpBtn.disabled = !canEcoSettings || prodOk >= PRODUCTION_MULT_MAX - 0.001;
      }
      if (typeof room.prepSecondsRemaining === 'number' && room.status === 'prep') {
        els.countdownText.textContent = 'Prep countdown: ' + room.prepSecondsRemaining + 's';
      } else {
        els.countdownText.textContent = 'Prep countdown: -';
      }
      const showResources = room.status === 'prep' || room.status === 'playing' || state.lastTickPayload;
      els.resourcesPanel.style.display = showResources ? 'block' : 'none';
      const showUpgradeButton = (room.status === 'prep' || room.status === 'playing') && state.role === 'defender';
      els.upgradeMenuBtn.style.display = showUpgradeButton ? 'block' : 'none';
      const showReadOnlyUpgrades = room.status === 'prep' || room.status === 'playing';
      els.upgradeReadOnlyPanel.style.display = showReadOnlyUpgrades ? 'block' : 'none';
      upgradeMenuController.renderReadOnlyList(room);
      upgradeMenuController.hydrateTerritoryOptions(room);
      upgradeMenuController.render();
      this.renderSelectionSummary();
      this.updateReadyButton(room);
      renderTradeRoutesOverlay();
    },
    renderSelectionSummary() {
      const list = selectedArray();
      els.selectionCountText.textContent = 'Selected territories: ' + list.length;
      els.territoryList.innerHTML = list.slice(0, 30).map(function (name) {
        return '<li>' + name + '</li>';
      }).join('');
    },
    updateReadyButton(room) {
      const canReady = !!(
        room &&
        state.role &&
        room.status === 'lobby' &&
        room.defenderSocketId &&
        room.attackerSocketId
      );
      els.readyBtn.disabled = !canReady;
    },
    renderTick(payload) {
      if (!payload) return;
      const resources = payload.defenderResources || {};
      els.resourcesPanel.style.display = 'block';
      els.resEmeralds.textContent = fmt(resources.emeralds);
      els.resWood.textContent = fmt(resources.wood);
      els.resOre.textContent = fmt(resources.ore);
      els.resCrops.textContent = fmt(resources.crops);
      els.resFish.textContent = fmt(resources.fish);
      const list = Array.isArray(payload.messages) ? payload.messages : [];
      els.tickMessages.innerHTML = list.slice(0, 8).map(function (m) {
        return '<li>' + m + '</li>';
      }).join('');
      if (typeof payload.nextTickInMs === 'number') {
        startTickCountdownTimer(payload.nextTickInMs);
      }
      refreshTerritoryTooltips();
    }
  };

  const upgradeMenuController = {
    hydrateTerritoryOptions(room) {
      const selected = (room && Array.isArray(room.selectedTerritories)) ? room.selectedTerritories : [];
      const prev = state.selectedUpgradeTerritory;
      els.upgradeTerritorySelect.innerHTML = selected.map(function (name) {
        return '<option value="' + name + '">' + name + '</option>';
      }).join('');
      els.hqTerritorySelect.innerHTML = selected.map(function (name) {
        return '<option value="' + name + '">' + name + '</option>';
      }).join('');
      if (selected.length === 0) {
        state.selectedUpgradeTerritory = '';
        els.setHqBtn.disabled = true;
        return;
      }
      if (prev && selected.indexOf(prev) !== -1) {
        state.selectedUpgradeTerritory = prev;
      } else {
        state.selectedUpgradeTerritory = selected[0];
      }
      els.upgradeTerritorySelect.value = state.selectedUpgradeTerritory;
      const serverHq = room && room.hqTerritory && selected.indexOf(room.hqTerritory) !== -1
        ? room.hqTerritory
        : selected[0];
      els.hqTerritorySelect.value = serverHq;
    },
    canSetHq() {
      const room = state.currentRoom;
      if (!room || (room.status !== 'prep' && room.status !== 'playing')) return false;
      if (state.role !== 'defender') return false;
      const selected = Array.isArray(room.selectedTerritories) ? room.selectedTerritories : [];
      const target = els.hqTerritorySelect.value || '';
      if (!target || selected.indexOf(target) === -1) return false;
      return true;
    },
    getSelectedUpgradeLevel(category) {
      const room = state.currentRoom || {};
      const territory = state.selectedUpgradeTerritory;
      const rows = room.territoryUpgrades || {};
      const level = rows[territory] && Number.isFinite(rows[territory][category])
        ? rows[territory][category]
        : 0;
      return Math.max(0, Math.min(11, parseInt(level || 0, 10) || 0));
    },
    canUpgrade(category) {
      const room = state.currentRoom;
      if (!room || (room.status !== 'playing' && room.status !== 'prep')) return false;
      if (state.role !== 'defender') return false;
      if (!state.selectedUpgradeTerritory) return false;
      const level = this.getSelectedUpgradeLevel(category);
      if (level >= 11) return false;
      return true;
    },
    renderCategory(category, cardEl, badgeEl, barEl, metaEl, btnEl) {
      const level = this.getSelectedUpgradeLevel(category);
      const nextCost = level < 11 && UPGRADE_COSTS[category]
        ? (UPGRADE_COSTS[category][level + 1] || 0)
        : 0;
      const can = this.canUpgrade(category);
      const maxed = level >= 11;
      if (category === 'storage') {
        const emeraldCost = level < 11 ? (STORAGE_COSTS.emeralds[level + 1] || 0) : 0;
        const woodCost = level < 11 ? (STORAGE_COSTS.wood[level + 1] || 0) : 0;
        metaEl.textContent = level >= 11
          ? 'Level 11 · Maxed'
          : 'Level ' + level + ' · Next cost ' + emeraldCost + ' emeralds + ' + woodCost + ' wood';
      } else {
        metaEl.textContent = level >= 11
          ? 'Level 11 · Maxed'
          : 'Level ' + level + ' · Hourly drain ' + nextCost + ' ' + UPGRADE_RESOURCE_BY_CATEGORY[category] + ' (inactive when insufficient)';
      }
      btnEl.disabled = !can;
      badgeEl.textContent = 'Lv' + level;
      badgeEl.classList.toggle('maxed', maxed);
      renderSegBar(barEl, level, maxed);
      cardEl.classList.remove('state-low', 'state-max');
      if (maxed) cardEl.classList.add('state-max');
      else if (!can) cardEl.classList.add('state-low');
    },
    renderNotices() {
      els.upgradeNoticeList.innerHTML = state.upgradeNotices.map(function (m) {
        return '<li>' + m + '</li>';
      }).join('');
    },
    renderStorageDashboard(room) {
      const container = document.getElementById('storageDashboardList');
      if (!container) return;
      if (!room || !Array.isArray(room.selectedTerritories) || room.selectedTerritories.length === 0) {
        container.innerHTML = '<li class="meta">No selected territories.</li>';
        return;
      }
      const hq = room.hqTerritory || room.selectedTerritories[0] || '';
      const upgrades = room.territoryUpgrades || {};
      const perStorage = room.perTerritoryStorage || {};
      container.innerHTML = room.selectedTerritories.map(function (name) {
        const row = perStorage[name] || { emeralds: 0, wood: 0, ore: 0, crops: 0, fish: 0 };
        const level = upgrades[name] && Number.isFinite(upgrades[name].storage)
          ? parseInt(upgrades[name].storage || 0, 10) || 0
          : 0;
        const isHq = name === hq;
        const cap = getStorageCapacity(level, isHq);
        const hqTag = isHq ? ' <strong>(HQ)</strong>' : '';
        return (
          '<li style="margin-bottom:8px;">' +
          '<div><strong>' + name + '</strong>' + hqTag + ' · ST Lv' + level + '</div>' +
          '<div style="font-size:12px;opacity:0.9;">' +
          'E: ' + fmt(row.emeralds) + '/' + fmt(cap) + ' | ' +
          'W: ' + fmt(row.wood) + '/' + fmt(cap) + ' | ' +
          'O: ' + fmt(row.ore) + '/' + fmt(cap) + ' | ' +
          'C: ' + fmt(row.crops) + '/' + fmt(cap) + ' | ' +
          'F: ' + fmt(row.fish) + '/' + fmt(cap) +
          '</div>' +
          '</li>'
        );
      }).join('');
    },
    renderReadOnlyList(room) {
      if (!room || room.status !== 'playing') {
        els.upgradeReadOnlyList.innerHTML = '';
        return;
      }
      const upgrades = room.territoryUpgrades || {};
      const selected = Array.isArray(room.selectedTerritories) ? room.selectedTerritories : [];
      els.upgradeReadOnlyList.innerHTML = selected.map(function (name) {
        const row = upgrades[name] || {};
        const d = parseInt(row.damage || 0, 10) || 0;
        const a = parseInt(row.attackSpeed || 0, 10) || 0;
        const h = parseInt(row.health || 0, 10) || 0;
        const def = parseInt(row.defense || 0, 10) || 0;
        const st = parseInt(row.storage || 0, 10) || 0;
        return '<li>' + name + ': D' + d + ' / AS' + a + ' / H' + h + ' / DEF' + def + ' / ST' + st + '</li>';
      }).join('');
    },
    render() {
      const room = state.currentRoom;
      const isDefender = state.role === 'defender';
      els.upgradeRoleHint.textContent = isDefender
        ? 'Defender mode: upgrades are interactive.'
        : 'Attacker view: read-only upgrade levels.';
      this.renderCategory('damage', els.upgradeDamageCard, els.upgradeDamageBadge, els.upgradeDamageBar, els.upgradeDamageMeta, els.upgradeDamageBtn);
      this.renderCategory('attackSpeed', els.upgradeAttackSpeedCard, els.upgradeAttackSpeedBadge, els.upgradeAttackSpeedBar, els.upgradeAttackSpeedMeta, els.upgradeAttackSpeedBtn);
      this.renderCategory('health', els.upgradeHealthCard, els.upgradeHealthBadge, els.upgradeHealthBar, els.upgradeHealthMeta, els.upgradeHealthBtn);
      this.renderCategory('defense', els.upgradeDefenseCard, els.upgradeDefenseBadge, els.upgradeDefenseBar, els.upgradeDefenseMeta, els.upgradeDefenseBtn);
      this.renderCategory('storage', els.upgradeStorageCard, els.upgradeStorageBadge, els.upgradeStorageBar, els.upgradeStorageMeta, els.upgradeStorageBtn);
      this.renderStorageDashboard(room);
      this.renderNotices();
      if (!room || (room.status !== 'playing' && room.status !== 'prep')) {
        els.upgradeDamageBtn.disabled = true;
        els.upgradeAttackSpeedBtn.disabled = true;
        els.upgradeHealthBtn.disabled = true;
        els.upgradeDefenseBtn.disabled = true;
        els.upgradeStorageBtn.disabled = true;
      }
      if (!isDefender) {
        els.upgradeDamageBtn.disabled = true;
        els.upgradeAttackSpeedBtn.disabled = true;
        els.upgradeHealthBtn.disabled = true;
        els.upgradeDefenseBtn.disabled = true;
        els.upgradeStorageBtn.disabled = true;
      }
      els.setHqBtn.disabled = !this.canSetHq();
    },
    open() {
      if (!state.currentRoom || (state.currentRoom.status !== 'playing' && state.currentRoom.status !== 'prep')) return;
      els.upgradeModal.style.display = 'flex';
      this.render();
    },
    close() {
      els.upgradeModal.style.display = 'none';
    },
    apply(category) {
      if (!state.currentRoom) return;
      if (!this.canUpgrade(category)) {
        playSfx('error');
        pushUpgradeNotice('Upgrade blocked for ' + category + ' (insufficient resources or maxed)');
        this.renderNotices();
        return;
      }
      state.socket.emit('upgrade:apply', {
        territoryName: state.selectedUpgradeTerritory,
        category
      }, function (resp) {
        if (!resp || !resp.ok) {
          playSfx('error');
          alert((resp && resp.error) || 'Upgrade failed.');
          return;
        }
        playSfx('success');
      });
    },
    setHqTerritory() {
      if (!state.currentRoom) return;
      if (!this.canSetHq()) {
        alert('HQ can only be changed by defender during prep/playing.');
        return;
      }
      const territoryName = (els.hqTerritorySelect.value || '').trim();
      state.socket.emit('setHqTerritory', { territoryName }, function (resp) {
        if (!resp || !resp.ok) {
          alert((resp && resp.error) || 'Failed to set HQ.');
          return;
        }
        setStatus('HQ moved to ' + resp.hqTerritory);
        pushUpgradeNotice('HQ moved to ' + resp.hqTerritory);
        upgradeMenuController.renderNotices();
      });
    }
  };

  const socketController = {
    persistSession(roomId, role, playerToken) {
      if (!/^\d{6}$/.test(roomId || '') || !playerToken) return;
      saveRoomSession({
        roomId,
        role,
        playerToken,
        socketBase: state.socketBase || ''
      });
    },
    tryResumeSession() {
      if (!state.socket || !state.connected || state.resumeInFlight) return;
      if (state.currentRoom && state.currentRoom.id) return;
      const session = loadRoomSession();
      if (!session) return;
      state.resumeInFlight = true;
      state.socket.emit('resumeRoom', {
        roomId: session.roomId,
        playerToken: session.playerToken
      }, function (resp) {
        state.resumeInFlight = false;
        if (!resp || !resp.ok) {
          clearRoomSession();
          setStatus('Connected to room server');
          return;
        }
        state.role = resp.role;
        setStatus('Session resumed: ' + resp.roomId + ' (' + resp.role + ')');
      });
    },
    init() {
      const socketBase = getEcoWarSocketBase();
      const sharedToken = getEcoWarSharedToken();
      if (!socketBase) {
        state.connected = false;
        setStatus(
          'Eco War needs a Socket.io server (not available on Vercel). Deploy server/proxy.js to Railway, Render, Fly.io, etc., then add <meta name="eco-war-socket-url" content="https://your-api.example.com"> to war.html.'
        );
        return;
      }
      state.socketBase = socketBase;
      const socketOptions = { transports: ['websocket', 'polling'] };
      if (sharedToken) {
        socketOptions.auth = { token: sharedToken };
      }
      state.socket = io(socketBase, socketOptions);
      state.socket.on('connect', function () {
        state.connected = true;
        setStatus('Connected to room server');
        socketController.tryResumeSession();
      });
      state.socket.on('connect_error', function () {
        state.connected = false;
        setStatus(
          'Room server not reachable at ' +
            socketBase +
            '. Check the URL, CORS, and that the process is running (local: npm start in server/ on port ' +
            SOCKET_DEV_PORT +
            ').'
        );
      });
      state.socket.on('disconnect', function () {
        state.connected = false;
        setStatus('Disconnected from room server');
      });
      state.socket.on('roomError', function (payload) {
        if (payload && payload.error) alert(payload.error);
      });
      state.socket.on('roomState', function (room) {
        state.currentRoom = room;
        if (!room) {
          clearRoomSession();
        }
        const inferredRole = inferRoleFromRoom(room);
        if (inferredRole) {
          state.role = inferredRole;
        }
        if (room && Array.isArray(room.selectedTerritories)) {
          selectionController.applyServerSelection(room.selectedTerritories);
        }
        lobbyView.renderRoom(room);
        refreshTerritoryTooltips();
      });
      state.socket.on('prepTick', function (payload) {
        if (!state.currentRoom) return;
        state.currentRoom.prepSecondsRemaining = payload.secondsRemaining;
        state.currentRoom.status = 'prep';
        lobbyView.renderRoom(state.currentRoom);
      });
      state.socket.on('statusChanged', function (payload) {
        if (!state.currentRoom) return;
        state.currentRoom.status = payload.status;
        lobbyView.renderRoom(state.currentRoom);
      });
      state.socket.on('tick:update', function (payload) {
        state.lastTickPayload = payload;
        if (state.currentRoom && payload && payload.perTerritoryStorage) {
          state.currentRoom.perTerritoryStorage = payload.perTerritoryStorage;
        }
        lobbyView.renderTick(payload);
      });
      state.socket.on('upgrade:applied', function (payload) {
        const line = payload.territoryName + ' · ' + payload.category + ' -> Lv' + payload.level;
        pushUpgradeNotice(line);
        upgradeMenuController.render();
      });
    },
    createRoom() {
      if (!state.connected) return alert('Socket server is not connected.');
      state.socket.emit('createRoom', {}, function (resp) {
        if (!resp || !resp.ok) {
          alert((resp && resp.error) || 'Failed to create room.');
          return;
        }
        state.role = 'defender';
        state.armedForDefenderCreate = false;
        els.createGameBtn.textContent = 'Create 1v1 Eco War Game';
        setStatus('Room created: ' + resp.roomId);
        socketController.persistSession(resp.roomId, 'defender', resp.playerToken || '');
        socketController.syncSelectionIfAllowed();
      });
    },
    joinRoom(roomId) {
      if (!state.connected) return alert('Socket server is not connected.');
      if (!/^\d{6}$/.test(roomId)) return alert('Room code must be exactly 6 digits.');
      state.socket.emit('joinRoom', { roomId }, function (resp) {
        if (!resp || !resp.ok) {
          alert((resp && resp.error) || 'Failed to join room.');
          return;
        }
        state.role = 'attacker';
        setStatus('Joined room: ' + resp.roomId);
        socketController.persistSession(resp.roomId, 'attacker', resp.playerToken || '');
      });
    },
    setReady() {
      if (!state.currentRoom) return;
      const effectiveRole = inferRoleFromRoom(state.currentRoom) || state.role;
      if (effectiveRole !== 'defender' && effectiveRole !== 'attacker') {
        alert('Role is not synced yet. Wait a moment and try again.');
        return;
      }
      const roleKey = effectiveRole === 'defender' ? 'defenderReady' : 'attackerReady';
      const nextReady = !state.currentRoom[roleKey];
      state.socket.emit('setReady', { ready: nextReady }, function (resp) {
        if (!resp || !resp.ok) {
          alert((resp && resp.error) || 'Failed to update ready state.');
        }
      });
    },
    syncSelectionIfAllowed() {
      if (!state.currentRoom || state.role !== 'defender') return;
      state.socket.emit('updateSelection', {
        selectedTerritories: selectedArray()
      }, function (resp) {
        if (resp && resp.ok === false && resp.error) {
          setStatus(resp.error);
        }
      });
    }
  };

  async function initMap() {
    const img = new Image();
    img.src = MAP_IMAGE_URL;
    await new Promise(function (resolve, reject) {
      img.onload = resolve;
      img.onerror = function () {
        reject(new Error('main-map.webp not found for war map'));
      };
    });
    state.geo = { imgW: img.naturalWidth, imgH: img.naturalHeight };
    const bounds = L.latLngBounds([[0, 0], [state.geo.imgH, state.geo.imgW]]);
    const overlayBounds = getImageOverlayBounds(state.geo.imgW, state.geo.imgH);
    state.map = L.map('map', {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 4,
      zoomSnap: 0.25,
      attributionControl: false
    });
    L.imageOverlay(MAP_IMAGE_URL, overlayBounds).addTo(state.map);
    state.map.fitBounds(bounds);
    state.routeLayer = L.layerGroup().addTo(state.map);

    const staticData = await territoryDataAdapter.loadStatic();
    const territories = territoryDataAdapter.parseTerritories(staticData);
    selectionController.initMapLayers(territories);
    applyLiveOwnership();
  }

  function bindUi() {
    els.createGameBtn.addEventListener('click', function () {
      if (!state.role && !state.currentRoom && !state.armedForDefenderCreate) {
        state.armedForDefenderCreate = true;
        els.createGameBtn.textContent = 'Create Room';
        state.role = 'defender';
        setStatus('Defender mode armed. Select territories, then click Create Room.');
        return;
      }
      if (state.armedForDefenderCreate && !state.currentRoom) {
        socketController.createRoom();
        return;
      }
      alert('You are already in a room. Open a new tab for another game.');
    });

    els.joinGameBtn.addEventListener('click', function () {
      const code = (els.joinCodeInput.value || '').trim();
      socketController.joinRoom(code);
    });

    els.readyBtn.addEventListener('click', function () {
      if (!state.currentRoom) return;
      socketController.setReady();
    });

    document.querySelectorAll('input[name="routeMode"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (state.role !== 'defender' || !state.socket || !state.currentRoom || !this.checked) return;
        state.socket.emit('eco:setRouteMode', { routeMode: this.value }, function (resp) {
          if (!resp || !resp.ok) {
            alert((resp && resp.error) || 'Failed to set route mode.');
          }
        });
      });
    });

    function adjustProductionMult(delta) {
      if (state.role !== 'defender' || !state.socket || !state.currentRoom) return;
      const cur = Number(state.currentRoom.productionMultiplier) || 1;
      const next = Math.max(
        PRODUCTION_MULT_MIN,
        Math.min(PRODUCTION_MULT_MAX, Math.round((cur + delta) * 100) / 100)
      );
      state.socket.emit('eco:setProductionMultiplier', { multiplier: next }, function (resp) {
        if (!resp || !resp.ok) {
          alert((resp && resp.error) || 'Failed to set production buff.');
        }
      });
    }

    if (els.prodMultDownBtn) {
      els.prodMultDownBtn.addEventListener('click', function () {
        adjustProductionMult(-0.1);
      });
    }
    if (els.prodMultUpBtn) {
      els.prodMultUpBtn.addEventListener('click', function () {
        adjustProductionMult(0.1);
      });
    }

    els.copyCodeBtn.addEventListener('click', async function () {
      const code = els.roomCodeText.textContent || '';
      if (!/^\d{6}$/.test(code)) return;
      try {
        await navigator.clipboard.writeText(code);
        setStatus('Copied room code: ' + code);
      } catch (_e) {
        setStatus('Copy failed. Code: ' + code);
      }
    });

    els.upgradeMenuBtn.addEventListener('click', function () {
      upgradeMenuController.open();
    });

    els.upgradeModalCloseBtn.addEventListener('click', function () {
      upgradeMenuController.close();
    });

    els.upgradeModal.addEventListener('click', function (ev) {
      if (ev.target === els.upgradeModal) {
        upgradeMenuController.close();
      }
    });

    els.upgradeTerritorySelect.addEventListener('change', function () {
      state.selectedUpgradeTerritory = els.upgradeTerritorySelect.value || '';
      upgradeMenuController.render();
    });
    els.hqTerritorySelect.addEventListener('change', function () {
      upgradeMenuController.render();
    });
    els.setHqBtn.addEventListener('click', function () {
      upgradeMenuController.setHqTerritory();
    });

    els.upgradeDamageBtn.addEventListener('click', function () {
      upgradeMenuController.apply('damage');
    });
    els.upgradeAttackSpeedBtn.addEventListener('click', function () {
      upgradeMenuController.apply('attackSpeed');
    });
    els.upgradeHealthBtn.addEventListener('click', function () {
      upgradeMenuController.apply('health');
    });
    els.upgradeDefenseBtn.addEventListener('click', function () {
      upgradeMenuController.apply('defense');
    });
    els.upgradeStorageBtn.addEventListener('click', function () {
      upgradeMenuController.apply('storage');
    });
    els.upgradeSfxToggleBtn.addEventListener('click', function () {
      setSfxEnabled(!state.sfxEnabled);
    });
  }

  async function init() {
    try {
      const saved = localStorage.getItem('warSfxEnabled');
      if (saved === '0') setSfxEnabled(false);
      else setSfxEnabled(true);
    } catch (_e) {
      setSfxEnabled(true);
    }
    bindUi();
    socketController.init();
    try {
      await initMap();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to initialize war map';
      setStatus(msg);
    }
  }

  init();
})();
