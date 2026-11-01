/**
 * AEGIS-CORE : Police Emergency Response CAD 112 Console Controller
 * Implements tactical Leaflet dark map, live incident feed synchronization,
 * dynamic biometric ECG canvas rendering, audio spectrogram simulation,
 * and patrol dispatch actions.
 */

let tacticalMap = null;
let victimMarker = null;
let victimCircle = null;
let patrolMarkers = [];
let routeLine = null;
let activeIncidentId = null;

let ecgCanvas = null;
let ecgCtx = null;
let ecgX = 0;
let ecgLastY = 35;
let ecgInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  initTacticalMap();
  initECGCanvas();
  initAudioSpectrogram();
  renderIncidentQueue();
  setupDispatchActions();

  // Listen for real-time broadcasts from Women's Device / Dashboard
  if (window.aegisState) {
    window.aegisState.subscribe((event) => {
      if (event.type === 'SOS_TRIGGERED') {
        handleIncomingSOS(event.incident);
      } else if (event.type === 'SOS_CANCELLED') {
        handleSOSCancelled(event.incidentId);
      } else if (event.type === 'UNIT_DISPATCHED' || event.type === 'INCIDENT_STATUS_CHANGED') {
        renderIncidentQueue();
        if (activeIncidentId === event.incident?.id) {
          loadIncidentDetails(event.incident);
        }
      } else if (event.type === 'TELEMETRY_UPDATED') {
        updateActiveTelemetry(event.data);
      }
    });
  }

  // Poll for incidents occasionally or pick first
  const incidents = window.aegisState ? window.aegisState.getIncidents() : [];
  if (incidents.length > 0) {
    selectIncident(incidents[0].id);
  }
});

/* ==========================================================================
   TACTICAL LEAFLET MAP SETUP
   ========================================================================== */
function initTacticalMap() {
  const mapEl = document.getElementById('tacticalMap');
  if (!mapEl) return;

  // Default coordinate: New Delhi NCR (IIT / South Ext area)
  const defaultLat = 28.5412;
  const defaultLng = 77.2014;

  tacticalMap = L.map('tacticalMap', {
    zoomControl: false,
    attributionControl: false
  }).setView([defaultLat, defaultLng], 15);

  // High performance dark tiles (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(tacticalMap);

  L.control.zoom({ position: 'bottomright' }).addTo(tacticalMap);

  // Add Patrol Units to Map
  renderPatrolUnits();
}

function renderPatrolUnits() {
  if (!tacticalMap) return;

  // Clear existing patrol markers
  patrolMarkers.forEach(m => tacticalMap.removeLayer(m));
  patrolMarkers = [];

  const units = [
    { name: 'PCR Van Bravo-12', lat: 28.5465, lng: 77.2070, type: 'van', eta: '2.8m' },
    { name: 'Pink Patrol Alpha-03', lat: 28.5360, lng: 77.2150, type: 'pink', eta: '4.5m' },
    { name: 'Bike Beat Delta-09', lat: 28.5380, lng: 77.1930, type: 'bike', eta: '3.1m' }
  ];

  units.forEach(u => {
    const icon = L.divIcon({
      className: 'custom-patrol-marker',
      html: `
        <div style="background: #0284C7; color: white; border: 2px solid #38BDF8; border-radius: 6px; padding: 3px 6px; font-size: 10px; font-weight: bold; font-family: monospace; white-space: nowrap; box-shadow: 0 0 10px rgba(56, 189, 248, 0.6); display: flex; align-items: center; gap: 4px;">
          <span>🚓 ${u.name}</span>
        </div>
      `,
      iconSize: [120, 26],
      iconAnchor: [60, 13]
    });

    const marker = L.marker([u.lat, u.lng], { icon }).addTo(tacticalMap);
    marker.bindPopup(`<strong>${u.name}</strong><br>Status: On Beat<br>Estimated ETA: ${u.eta}`);
    patrolMarkers.push(marker);
  });
}

function updateVictimLocationOnMap(lat, lng, victimName = 'Victim', accuracy = 25) {
  if (!tacticalMap) return;

  if (victimMarker) tacticalMap.removeLayer(victimMarker);
  if (victimCircle) tacticalMap.removeLayer(victimCircle);
  if (routeLine) tacticalMap.removeLayer(routeLine);

  // Pulsing SOS marker
  const victimIcon = L.divIcon({
    className: 'custom-victim-marker',
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: pulse-ring 1.4s infinite;"></div>
        <div style="position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #EF4444; border: 2px solid white; box-shadow: 0 0 15px #EF4444;"></div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });

  victimMarker = L.marker([lat, lng], { icon: victimIcon }).addTo(tacticalMap);
  victimMarker.bindPopup(`<strong>${victimName}</strong><br>NavIC Accuracy: 1.4m<br>Live Telemetry Streaming`).openPopup();

  // Accuracy circle
  victimCircle = L.circle([lat, lng], {
    color: '#EF4444',
    fillColor: '#EF4444',
    fillOpacity: 0.12,
    radius: accuracy
  }).addTo(tacticalMap);

  // Route from nearest unit (PCR Bravo-12)
  const pcrLat = 28.5465;
  const pcrLng = 77.2070;
  routeLine = L.polyline([
    [pcrLat, pcrLng],
    [lat, lng]
  ], {
    color: '#38BDF8',
    weight: 3,
    dashArray: '6, 8',
    opacity: 0.85
  }).addTo(tacticalMap);

  tacticalMap.panTo([lat, lng]);
}

/* ==========================================================================
   CAD INCIDENT QUEUE RENDERING
   ========================================================================== */
function renderIncidentQueue() {
  const container = document.getElementById('incidentQueueList');
  if (!container || !window.aegisState) return;

  const incidents = window.aegisState.getIncidents();
  const countEl = document.getElementById('activeIncidentCount');
  if (countEl) countEl.textContent = incidents.filter(i => i.status !== 'SECURED' && i.status !== 'CANCELLED_BY_USER').length;

  container.innerHTML = incidents.map(inc => {
    const isSelected = inc.id === activeIncidentId;
    const isCritical = inc.urgency === 'CRITICAL' || inc.status === 'UNACKNOWLEDGED';
    const isDispatched = inc.status === 'UNIT_DISPATCHED';

    let badgeClass = 'badge-slate';
    if (isCritical) badgeClass = 'badge-crimson';
    else if (isDispatched) badgeClass = 'badge-cyan';
    else if (inc.status === 'ON_SCENE') badgeClass = 'badge-amber';
    else if (inc.status === 'SECURED') badgeClass = 'badge-emerald';

    return `
      <div class="incident-ticket ${isSelected ? 'selected' : ''} ${isCritical ? 'priority-critical' : ''}" 
           onclick="selectIncident('${inc.id}')">
        <div class="incident-ticket-head">
          <span class="incident-id">${inc.id}</span>
          <span class="badge ${badgeClass}">${inc.status.replace('_', ' ')}</span>
        </div>
        <div class="incident-victim-name">${inc.victimName} (${inc.age}y, ${inc.bloodGroup})</div>
        <div class="incident-location-brief">
          <i data-lucide="map-pin" style="width:12px;"></i>
          <span>${inc.locationName || 'Near Hauz Khas / IIT Perimeter'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.75rem; font-family: var(--font-mono); color: var(--text-muted);">
          <span>Unit: <strong class="text-cyan">${inc.assignedUnit || 'UNASSIGNED'}</strong></span>
          <span class="text-crimson">${inc.heartRateBpm ? inc.heartRateBpm + ' BPM' : '98 BPM'}</span>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function selectIncident(id) {
  activeIncidentId = id;
  const incidents = window.aegisState ? window.aegisState.getIncidents() : [];
  const incident = incidents.find(i => i.id === id);
  if (!incident) return;

  renderIncidentQueue();
  loadIncidentDetails(incident);

  if (window.tacticalAudio) window.tacticalAudio.playClick();
}

function loadIncidentDetails(inc) {
  const nameEl = document.getElementById('detailVictimName');
  const metaEl = document.getElementById('detailVictimMeta');
  const idEl = document.getElementById('detailIncidentId');
  const locEl = document.getElementById('detailLocation');
  const coordsEl = document.getElementById('detailCoords');
  const unitEl = document.getElementById('detailAssignedUnit');
  const etaEl = document.getElementById('detailEta');
  const statusEl = document.getElementById('detailStatusBadge');
  const cctvEl = document.getElementById('detailCctvId');
  const bpmEl = document.getElementById('detailBpm');

  if (nameEl) nameEl.textContent = inc.victimName;
  if (metaEl) metaEl.textContent = `Age: ${inc.age} • Blood: ${inc.bloodGroup} • Wearable: ${inc.deviceModel || 'Aegis Ring Mk.3'}`;
  if (idEl) idEl.textContent = inc.id;
  if (locEl) locEl.textContent = inc.locationName || 'IIT Delhi Ring Road Outer Sector';
  if (coordsEl) coordsEl.textContent = `${inc.lat.toFixed(4)}° N, ${inc.lng.toFixed(4)}° E`;
  if (unitEl) unitEl.textContent = inc.assignedUnit || 'UNASSIGNED';
  if (etaEl) etaEl.textContent = inc.unitEta || 'Pending Dispatch';
  if (cctvEl) cctvEl.textContent = inc.cctvCameraId || 'CCTV-STH-088-PTZ';
  if (bpmEl) bpmEl.textContent = `${inc.heartRateBpm || 148} BPM (TACHYCARDIA)`;

  if (statusEl) {
    statusEl.textContent = inc.status.replace('_', ' ');
    statusEl.className = `badge ${inc.urgency === 'CRITICAL' ? 'badge-crimson' : 'badge-cyan'}`;
  }

  // Update Map Position
  updateVictimLocationOnMap(inc.lat, inc.lng, inc.victimName);
}

/* ==========================================================================
   EVENT HANDLERS FOR CROSS-TAB ALERTS
   ========================================================================== */
function handleIncomingSOS(incident) {
  if (window.tacticalAudio) {
    window.tacticalAudio.playDispatchChime();
  }

  activeIncidentId = incident.id;
  renderIncidentQueue();
  loadIncidentDetails(incident);

  // Play radio squelch after alert
  setTimeout(() => {
    if (window.tacticalAudio) window.tacticalAudio.playRadioSquelch();
  }, 1000);
}

function handleSOSCancelled(incidentId) {
  if (window.tacticalAudio) {
    window.tacticalAudio.playConfirm();
  }
  renderIncidentQueue();
  if (activeIncidentId === incidentId) {
    const incidents = window.aegisState.getIncidents();
    const target = incidents.find(i => i.id === incidentId);
    if (target) loadIncidentDetails(target);
  }
}

function updateActiveTelemetry(data) {
  const bpmEl = document.getElementById('detailBpm');
  if (bpmEl && data.heartRateBpm) {
    bpmEl.textContent = `${data.heartRateBpm} BPM ${data.heartRateBpm > 120 ? '(TACHYCARDIA)' : '(STABLE)'}`;
  }
}

/* ==========================================================================
   CAD DISPATCH ACTIONS
   ========================================================================== */
function setupDispatchActions() {
  const dispatchBtn = document.getElementById('btnDispatchUnit');
  const cctvBtn = document.getElementById('btnLockCctv');
  const resolveBtn = document.getElementById('btnResolveCase');

  if (dispatchBtn) {
    dispatchBtn.addEventListener('click', () => {
      if (!activeIncidentId || !window.aegisState) return;

      if (window.tacticalAudio) {
        window.tacticalAudio.playRadioSquelch();
      }

      window.aegisState.dispatchUnit(activeIncidentId, 'PCR Van Bravo-12', 'Insp. K. Raman');
      alert(`Dispatch order confirmed: PCR Van Bravo-12 routed to incident ${activeIncidentId}. Radio channel encrypted.`);
    });
  }

  if (cctvBtn) {
    cctvBtn.addEventListener('click', () => {
      if (window.tacticalAudio) window.tacticalAudio.playClick();
      alert('Traffic Police PTZ Camera lock acquired on coordinates 28.5412° N, 77.2014° E. Live stream linked to responding patrol unit.');
    });
  }

  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => {
      if (!activeIncidentId || !window.aegisState) return;

      const confirmResolve = confirm(`Are you sure you want to mark incident ${activeIncidentId} as SECURED / RESOLVED?`);
      if (confirmResolve) {
        if (window.tacticalAudio) window.tacticalAudio.playConfirm();
        window.aegisState.updateIncidentStatus(activeIncidentId, 'SECURED', 'Victim reached by PCR Bravo-12. Secured safely.');
        renderIncidentQueue();
      }
    });
  }
}

/* ==========================================================================
   DYNAMIC BIOMETRIC ECG CANVAS RENDERER
   ========================================================================== */
function initECGCanvas() {
  ecgCanvas = document.getElementById('ecgCanvas');
  if (!ecgCanvas) return;

  ecgCtx = ecgCanvas.getContext('2d');
  ecgCanvas.width = ecgCanvas.offsetWidth || 300;
  ecgCanvas.height = ecgCanvas.offsetHeight || 70;

  ecgCtx.fillStyle = '#06090F';
  ecgCtx.fillRect(0, 0, ecgCanvas.width, ecgCanvas.height);

  if (ecgInterval) clearInterval(ecgInterval);
  ecgInterval = setInterval(drawECGStep, 40);
}

function drawECGStep() {
  if (!ecgCtx || !ecgCanvas) return;

  const w = ecgCanvas.width;
  const h = ecgCanvas.height;
  const baseline = h / 2;

  // Clear 4px slice ahead
  ecgCtx.fillStyle = 'rgba(6, 9, 15, 0.4)';
  ecgCtx.fillRect(ecgX, 0, 8, h);

  let newY = baseline + (Math.random() * 4 - 2);

  // Generate ECG QRS wave every 30 steps
  const cycle = ecgX % 32;
  if (cycle === 14) newY = baseline - 4;   // P wave
  else if (cycle === 18) newY = baseline + 6;  // Q wave
  else if (cycle === 19) newY = baseline - 24; // R peak
  else if (cycle === 20) newY = baseline + 12; // S wave
  else if (cycle === 24) newY = baseline - 6;  // T wave

  ecgCtx.beginPath();
  ecgCtx.strokeStyle = '#EF4444';
  ecgCtx.lineWidth = 1.8;
  ecgCtx.moveTo(ecgX, ecgLastY);
  ecgCtx.lineTo(ecgX + 2, newY);
  ecgCtx.stroke();

  ecgLastY = newY;
  ecgX += 2;
  if (ecgX >= w) {
    ecgX = 0;
  }
}

/* ==========================================================================
   TACTICAL AUDIO SPECTROGRAM SIMULATION
   ========================================================================== */
function initAudioSpectrogram() {
  const specContainer = document.getElementById('spectrogramContainer');
  if (!specContainer) return;

  specContainer.innerHTML = '';
  const barCount = 24;
  const bars = [];

  for (let i = 0; i < barCount; i++) {
    const b = document.createElement('div');
    b.className = 'spec-bar';
    b.style.height = `${Math.floor(Math.random() * 60 + 15)}%`;
    specContainer.appendChild(b);
    bars.push(b);
  }

  setInterval(() => {
    bars.forEach(b => {
      const h = Math.floor(Math.random() * 75 + 10);
      b.style.height = `${h}%`;
    });
  }, 120);
}
