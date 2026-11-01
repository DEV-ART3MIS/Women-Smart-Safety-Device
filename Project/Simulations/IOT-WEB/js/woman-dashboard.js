/**
 * AEGIS-CORE : Women's Guardian Safety Portal Controller
 * Manages live device working status & hardware KPIs:
 *  - 18650 Li-ion Cell % & TP4056 Voltage
 *  - NEO-6M High-Precision Geolocation (Lat/Lng, Sats, CEP)
 *  - MPU6050 6-Axis Motion, Gyro, and Impact / Fall Detection
 *  - SIM800L Distress Link to Police CAD 112 & AT Command Terminal
 *  - 0.96" OLED I2C Hardware Mirror Screen (Digital Twin)
 *  - Tactile Emergency SOS countdown modal with PIN 1122 disarm
 *  - "Walk With Me" escort timer and Safe Zone geofencing
 */

let countdownInterval = null;
let secondsRemaining = 15;
let currentEmergencyIncident = null;

let walkInterval = null;
let walkSeconds = 1500; // 25 mins

document.addEventListener('DOMContentLoaded', () => {
  renderTelemetry();
  renderContacts();
  renderSafeZones();
  setupEmergencyButton();
  setupCancelModal();
  setupWalkWithMe();
  setupModeToggles();
  setupFallSimulator();
  setupAudioToggle();

  // Listen to cross-tab updates (State Bus)
  if (window.aegisState) {
    window.aegisState.subscribe((event) => {
      if (event.type === 'TELEMETRY_UPDATED' || event.type === 'SOS_TRIGGERED' || event.type === 'SOS_CANCELLED') {
        renderTelemetry();
      }
    });
  }

  // Live real-time hardware telemetry tick (every 2.5s)
  setInterval(simulateVitalTicks, 2500);

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * Simulates realistic real-time hardware telemetry fluctuations
 * (Subtle MPU6050 inertial tremor, NEO-6M GPS satellite micro-drift, battery monitoring)
 */
function simulateVitalTicks() {
  if (!window.aegisState) return;
  const current = window.aegisState.getTelemetry();

  // If device is in panic mode, let panic telemetry persist until disarmed
  if (current.stressLevel === 'CRITICAL_PANIC') {
    // During panic: maintain elevated heart rate and active distress state
    const panicBpm = Math.floor(Math.random() * 6) + 148;
    window.aegisState.updateTelemetry({ heartRateBpm: panicBpm });
    return;
  }

  // Normal standby mode: realistic physiological and sensor noise
  const deltaBpm = (Math.random() * 4 - 2);
  let newBpm = Math.round((current.heartRateBpm || 74) + deltaBpm);
  newBpm = Math.max(68, Math.min(84, newBpm));

  // MPU6050 6-Axis micro-readings (slight body movement around gravity 1.0g)
  const ax = parseFloat((0.03 + (Math.random() - 0.5) * 0.05).toFixed(2));
  const ay = parseFloat((-0.02 + (Math.random() - 0.5) * 0.04).toFixed(2));
  const az = parseFloat((0.98 + (Math.random() - 0.5) * 0.03).toFixed(2));
  const totalG = parseFloat(Math.sqrt(ax * ax + ay * ay + az * az).toFixed(2));

  const gx = parseFloat((0.8 + (Math.random() - 0.5) * 0.8).toFixed(1));
  const gy = parseFloat((-1.1 + (Math.random() - 0.5) * 0.8).toFixed(1));
  const gz = parseFloat((0.1 + (Math.random() - 0.5) * 0.4).toFixed(1));

  // NEO-6M realistic satellite drift (±0.00004 deg ≈ 3-4 meters CEP)
  const baseLat = 28.5412;
  const baseLng = 77.2014;
  const lat = parseFloat((baseLat + (Math.random() - 0.5) * 0.00006).toFixed(4));
  const lng = parseFloat((baseLng + (Math.random() - 0.5) * 0.00006).toFixed(4));
  const sats = Math.random() > 0.4 ? 9 : 10;

  // Battery voltage micro-stability
  const voltage = parseFloat((3.94 + (Math.random() - 0.5) * 0.01).toFixed(2));

  window.aegisState.updateTelemetry({
    heartRateBpm: newBpm,
    batteryVoltage: voltage,
    lat,
    lng,
    satellites: sats,
    mpuAx: ax,
    mpuAy: ay,
    mpuAz: az,
    mpuGx: gx,
    mpuGy: gy,
    mpuGz: gz,
    mpuTotalG: totalG
  });
}

/**
 * Renders all hardware KPIs and working status onto the Women's Dashboard:
 * 1. 18650 Li-ion Battery % & TP4056 Power Architecture
 * 2. NEO-6M Geolocation (Lat/Lng, Satellites, CEP accuracy)
 * 3. MPU6050 6-Axis Motion & Threat Assessment
 * 4. SIM800L Distress Signal Link & AT Command Console
 * 5. 0.96" OLED Hardware Mirror Screen (Digital Twin)
 */
function renderTelemetry() {
  const t = window.aegisState ? window.aegisState.getTelemetry() : {};
  const isPanic = t.stressLevel === 'CRITICAL_PANIC';

  // -------------------------------------------------------------
  // 1. 18650 Li-ion Battery & TP4056 Power Subsystem
  // -------------------------------------------------------------
  const batVal = document.getElementById('kpiBatteryVal');
  const voltVal = document.getElementById('kpiVoltageVal');
  const batBar = document.getElementById('kpiBatteryBar');
  const batBadge = document.getElementById('kpiBatteryStatusBadge');
  const chargerState = document.getElementById('kpiChargerState');
  const batTemp = document.getElementById('kpiBatteryTemp');

  const pct = t.batteryPercent || 82;
  const v = t.batteryVoltage || 3.94;

  if (batVal) batVal.textContent = `${pct}%`;
  if (voltVal) voltVal.textContent = `(${v}V)`;
  if (batBar) {
    batBar.style.width = `${pct}%`;
    if (pct <= 20) {
      batBar.style.background = 'linear-gradient(90deg, #EF4444, #F43F5E)';
    } else {
      batBar.style.background = 'linear-gradient(90deg, #10B981, #06B6D4)';
    }
  }
  if (batBadge) {
    if (pct <= 20) {
      batBadge.textContent = 'LOW CELL (CHARGE)';
      batBadge.className = 'badge badge-crimson';
    } else {
      batBadge.textContent = 'TP4056 OK';
      batBadge.className = 'badge badge-emerald';
    }
  }
  if (chargerState) chargerState.textContent = t.batteryStatus || 'Discharging / Standby';
  if (batTemp) batTemp.textContent = t.batteryTemp || '31.2°C (Normal)';

  // -------------------------------------------------------------
  // 2. NEO-6M High-Precision Geolocation (UART1: GPIO 16/17)
  // -------------------------------------------------------------
  const latVal = document.getElementById('kpiLatVal');
  const lngVal = document.getElementById('kpiLngVal');
  const gpsFixBadge = document.getElementById('kpiGpsFixBadge');
  const satCount = document.getElementById('kpiSatCount');
  const precision = document.getElementById('kpiPrecision');
  const altitude = document.getElementById('kpiAltitude');
  const velocity = document.getElementById('kpiVelocity');

  const currentLat = t.lat ? Number(t.lat).toFixed(4) : '28.5412';
  const currentLng = t.lng ? Number(t.lng).toFixed(4) : '77.2014';

  if (latVal) latVal.textContent = `${currentLat}° N`;
  if (lngVal) lngVal.textContent = `${currentLng}° E`;
  if (gpsFixBadge) gpsFixBadge.textContent = t.gpsFix || '3D SATELLITE FIX';
  if (satCount) satCount.textContent = `${t.satellites || 9} Sats Locked`;
  if (precision) precision.textContent = t.gpsAccuracy || '2.4m CEP (Patch Ant)';
  if (altitude) altitude.textContent = `${t.altitude || 216} Meters`;
  if (velocity) velocity.textContent = t.gpsSpeed || '0.0 km/h (Stationary)';

  // -------------------------------------------------------------
  // 3. MPU6050 6-Axis Motion & Threat Assessment (I2C: GPIO 21/22)
  // -------------------------------------------------------------
  const totalGVal = document.getElementById('kpiTotalGVal');
  const mpuBadge = document.getElementById('kpiMpuBadge');
  const mpuThreat = document.getElementById('kpiMpuThreat');
  const accelReadout = document.getElementById('kpiAccelReadout');
  const gyroReadout = document.getElementById('kpiGyroReadout');

  const gForce = t.mpuTotalG ? Number(t.mpuTotalG).toFixed(2) : '0.99';
  const ax = t.mpuAx !== undefined ? Number(t.mpuAx).toFixed(2) : '+0.04';
  const ay = t.mpuAy !== undefined ? Number(t.mpuAy).toFixed(2) : '-0.02';
  const az = t.mpuAz !== undefined ? Number(t.mpuAz).toFixed(2) : '+0.98';

  const gx = t.mpuGx !== undefined ? Number(t.mpuGx).toFixed(1) : '0.8';
  const gy = t.mpuGy !== undefined ? Number(t.mpuGy).toFixed(1) : '-1.2';
  const gz = t.mpuGz !== undefined ? Number(t.mpuGz).toFixed(1) : '0.1';

  if (totalGVal) {
    totalGVal.textContent = `${gForce} g`;
    if (isPanic || Number(gForce) > 2.5) {
      totalGVal.style.color = 'var(--crimson-500)';
    } else {
      totalGVal.style.color = '#FFF';
    }
  }

  if (mpuBadge) {
    if (isPanic || Number(gForce) > 2.5) {
      mpuBadge.textContent = 'HIGH IMPACT / FALL';
      mpuBadge.className = 'badge badge-crimson';
    } else {
      mpuBadge.textContent = 'NORMAL TRANSIT';
      mpuBadge.className = 'badge badge-emerald';
    }
  }

  if (mpuThreat) {
    if (isPanic || Number(gForce) > 2.5) {
      mpuThreat.textContent = 'CRITICAL: Physical Assault / Fall Shock Detected (>2.50g)!';
      mpuThreat.className = 'text-crimson';
    } else {
      mpuThreat.textContent = 'Stable • No Physical Assault Detected';
      mpuThreat.className = 'text-emerald';
    }
  }

  if (accelReadout) {
    const axSign = ax >= 0 ? '+' : '';
    const aySign = ay >= 0 ? '+' : '';
    const azSign = az >= 0 ? '+' : '';
    accelReadout.textContent = `X:${axSign}${ax} Y:${aySign}${ay} Z:${azSign}${az}g`;
  }

  if (gyroReadout) {
    gyroReadout.textContent = `Gx:${gx} Gy:${gy} Gz:${gz} °/s`;
  }

  // -------------------------------------------------------------
  // 4. SIM800L Distress Link to Police CAD 112 (UART2: GPIO 26/27)
  // -------------------------------------------------------------
  const distressBadge = document.getElementById('kpiDistressBadge');
  const distressSignalText = document.getElementById('kpiDistressSignalText');
  const simTerminalBox = document.getElementById('sim800lTerminalBox');

  if (distressBadge) {
    if (isPanic) {
      distressBadge.textContent = 'DISTRESS SENT (112 CAD)';
      distressBadge.className = 'badge badge-crimson';
    } else {
      distressBadge.textContent = 'STANDBY (ARMED)';
      distressBadge.className = 'badge badge-cyan';
    }
  }

  if (distressSignalText) {
    if (isPanic) {
      distressSignalText.innerHTML = `
        <span class="pulse-dot crimson"></span>
        <span style="color: #F87171; font-weight: 800;">POLICE CAD ALERT DISPATCHED</span>
      `;
    } else {
      distressSignalText.innerHTML = `
        <span class="text-emerald">READY FOR DISPATCH</span>
      `;
    }
  }

  // Populate interactive AT Command Log
  if (simTerminalBox && t.sim800lLog && Array.isArray(t.sim800lLog)) {
    simTerminalBox.innerHTML = t.sim800lLog.map(line => {
      const isAlert = line.includes('EMERGENCY') || line.includes('IMPACT') || line.includes('ALERT') || line.includes('CAD') || line.includes('SHOCK');
      const isSuccess = line.includes('OK') || line.includes('VALID') || line.includes('READY') || line.includes('REGISTERED');
      const color = isAlert ? 'color: #F87171; font-weight: 700;' : isSuccess ? 'color: #34D399;' : 'color: #38BDF8;';
      return `<div class="sim-terminal-line" style="${color}">${escapeHtml(line)}</div>`;
    }).join('');
    // Auto scroll terminal to latest message
    simTerminalBox.scrollTop = simTerminalBox.scrollHeight;
  }

  // -------------------------------------------------------------
  // 5. 0.96" OLED Mirror Screen (I2C Digital Twin)
  // -------------------------------------------------------------
  const oledBat = document.getElementById('oledBatPill');
  const oledGps = document.getElementById('oledGpsLine');
  const oledGsm = document.getElementById('oledGsmLine');
  const oledMpu = document.getElementById('oledMpuLine');
  const oledStatus = document.getElementById('oledStatusLine');

  if (oledBat) oledBat.textContent = `BAT: ${pct}%`;
  if (oledGps) oledGps.textContent = `${currentLat}N, ${currentLng}E`;
  if (oledGsm) oledGsm.textContent = isPanic ? 'EMERGENCY DISPATCH' : `OK [${t.sim800lSignalDbm || -78}dBm]`;
  if (oledMpu) oledMpu.textContent = `${gForce}G ${isPanic ? 'SHOCK!!' : 'STABLE'}`;

  if (oledStatus) {
    if (isPanic) {
      oledStatus.textContent = '>> !! CAD 112 SOS !! <<';
      oledStatus.style.color = '#EF4444';
      oledStatus.className = 'oled-line alert';
    } else {
      oledStatus.textContent = '>> SYSTEM ARMED <<';
      oledStatus.style.color = '#10B981';
      oledStatus.className = 'oled-line';
    }
  }

  // -------------------------------------------------------------
  // Top Header Micro-Telemetry Status Bar
  // -------------------------------------------------------------
  const batEl = document.getElementById('telemetryBattery');
  const gpsEl = document.getElementById('telemetryGps');
  const sigEl = document.getElementById('telemetrySignal');
  const statusEl = document.getElementById('telemetryStatus');
  const micEl = document.getElementById('telemetryMic');

  if (batEl) batEl.textContent = `${pct}% (${v}V • 18650)`;
  if (gpsEl) gpsEl.textContent = `3D FIX (${currentLat}°N, ${currentLng}°E)`;
  if (sigEl) sigEl.textContent = t.signalStrength || `CSQ ${t.sim800lCsq || 24} (${t.sim800lSignalDbm || -78} dBm)`;
  if (micEl) micEl.textContent = 'ARMED (GPIO 35)';
  if (statusEl) {
    if (isPanic) {
      statusEl.textContent = 'IMPACT / PANIC ACTIVE';
      statusEl.className = 't-value text-crimson';
    } else {
      statusEl.textContent = `STABLE (${gForce}G)`;
      statusEl.className = 't-value text-emerald';
    }
  }
}

/**
 * Fall & Physical Assault Simulator
 * Allows user to test the MPU6050 high-G impact trigger (>2.50g threshold)
 */
function setupFallSimulator() {
  const fallBtn = document.getElementById('btnSimulateFall');
  if (!fallBtn) return;

  fallBtn.addEventListener('click', () => {
    if (!window.aegisState) return;

    // Trigger audible warning
    if (window.tacticalAudio) {
      window.tacticalAudio.playDispatchChime();
    }

    const currentLogs = window.aegisState.getTelemetry().sim800lLog || [];
    const updatedLogs = [
      `>> MPU6050 THRESHOLD EXCEEDED: 2.87G HIGH-IMPACT SHOCK DETECTED [${new Date().toLocaleTimeString()}] <<`,
      'MPU6050: INT1 PIN HIGH (GPIO 21/22) -> FALL INTERRUPT SERVICE ROUTINE FIRED',
      'SIM800L: AT+CMGS="112" -> AUTOMATIC CAD DISTRESS PACKET TRANSMITTED',
      'SIM800L: AT+CREG? -> 0,1 CELLULAR LOCK VERIFIED',
      'NEO-6M: LAT 28.5412, LNG 77.2014 FIXED TO EMERGENCY DISPATCH PACKET',
      ...currentLogs.slice(0, 5)
    ];

    window.aegisState.updateTelemetry({
      mpuAx: 1.65,
      mpuAy: 1.95,
      mpuAz: 1.34,
      mpuTotalG: 2.87,
      mpuGx: 142.5,
      mpuGy: -88.4,
      mpuGz: 55.2,
      mpuStatus: 'HIGH G IMPACT / ASSAULT DETECTED (2.87G)',
      distressSmsStatus: 'DISPATCHED: POLICE 112 + 3 CONTACTS',
      distressCallStatus: 'CONNECTING TO CAD 112',
      sim800lLog: updatedLogs
    });

    renderTelemetry();

    // Start emergency countdown so user can review or disarm
    startEmergencyCountdown();
  });
}

/**
 * Audio Engine Mute/Unmute toggle in nav
 */
function setupAudioToggle() {
  const toggleBtn = document.getElementById('audioToggleBtn');
  const icon = document.getElementById('audioIcon');
  if (!toggleBtn || !icon || !window.tacticalAudio) return;

  toggleBtn.addEventListener('click', () => {
    const isMuted = window.tacticalAudio.toggleMute();
    if (isMuted) {
      toggleBtn.classList.add('muted');
      icon.setAttribute('data-lucide', 'volume-x');
    } else {
      toggleBtn.classList.remove('muted');
      icon.setAttribute('data-lucide', 'volume-2');
      window.tacticalAudio.playClick();
    }
    if (window.lucide) window.lucide.createIcons();
  });
}

function renderContacts() {
  const container = document.getElementById('contactsContainer');
  if (!container || !window.aegisState) return;

  const settings = window.aegisState.getSettings();
  const contacts = settings.contacts || [];

  container.innerHTML = contacts.map(c => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.9rem; background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
      <div>
        <div style="font-weight: 600; font-size: 0.95rem; color: #FFF;">${escapeHtml(c.name)}</div>
        <div style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--text-muted);">${escapeHtml(c.phone)}</div>
      </div>
      <span class="badge ${c.priority === 'POLICE_CAD' ? 'badge-cyan' : 'badge-emerald'}">
        ${escapeHtml(c.priority.replace('_', ' '))}
      </span>
    </div>
  `).join('');
}

function renderSafeZones() {
  const container = document.getElementById('safeZonesContainer');
  if (!container || !window.aegisState) return;

  const settings = window.aegisState.getSettings();
  const zones = settings.safeZones || [];

  container.innerHTML = zones.map(z => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.9rem; background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.12); color: var(--emerald-500); display: flex; align-items: center; justify-content: center;">
          <i data-lucide="map-pin" style="width:16px;"></i>
        </div>
        <div>
          <div style="font-weight: 600; font-size: 0.9rem; color: #FFF;">${escapeHtml(z.name)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">Radius: ${escapeHtml(z.radius)}</div>
        </div>
      </div>
      <span class="badge ${z.status === 'INSIDE' ? 'badge-emerald' : 'badge-slate'}">
        ${escapeHtml(z.status)}
      </span>
    </div>
  `).join('');
  if (window.lucide) window.lucide.createIcons();
}

function setupEmergencyButton() {
  const sosBtn = document.getElementById('primarySosButton');
  if (!sosBtn) return;

  sosBtn.addEventListener('click', () => {
    startEmergencyCountdown();
  });
}

function startEmergencyCountdown() {
  secondsRemaining = 15;
  const modal = document.getElementById('emergencyCountdownModal');
  const pinInput = document.getElementById('cancelPinInput');
  const feedbackMsg = document.getElementById('cancelFeedbackMsg');

  if (!modal) return;
  modal.classList.add('active');
  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }
  if (feedbackMsg) feedbackMsg.textContent = '';

  if (window.tacticalAudio) {
    window.tacticalAudio.playDispatchChime();
  }

  updateTimerUI();

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    secondsRemaining--;
    updateTimerUI();

    if (secondsRemaining <= 0) {
      clearInterval(countdownInterval);
      dispatchConfirmedSOS();
    }
  }, 1000);
}

function updateTimerUI() {
  const timerDisplay = document.getElementById('countdownNumber');
  if (timerDisplay) {
    timerDisplay.textContent = secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining;
  }
}

function setupCancelModal() {
  const cancelBtn = document.getElementById('submitCancelPinBtn');
  const pinInput = document.getElementById('cancelPinInput');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', handlePinCancel);
  }

  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlePinCancel();
    });
  }
}

function handlePinCancel() {
  const pinInput = document.getElementById('cancelPinInput');
  const feedbackMsg = document.getElementById('cancelFeedbackMsg');
  const enteredPin = pinInput ? pinInput.value.trim() : '';

  if (enteredPin === '1122') {
    if (countdownInterval) clearInterval(countdownInterval);
    const modal = document.getElementById('emergencyCountdownModal');
    if (modal) modal.classList.remove('active');

    if (window.tacticalAudio) {
      window.tacticalAudio.playConfirm();
      window.tacticalAudio.stopSOSAlarm();
    }

    alert('Disarm PIN verified (1122). Emergency alert cancelled before CAD broadcast.');

    // Reset state and hardware KPIs
    if (window.aegisState) {
      if (currentEmergencyIncident) {
        window.aegisState.cancelSOS(currentEmergencyIncident.id, '1122');
        currentEmergencyIncident = null;
      } else {
        // Reset telemetry directly if triggered via fall test
        window.aegisState.updateTelemetry({
          stressLevel: 'NORMAL',
          mpuAx: 0.04,
          mpuAy: -0.02,
          mpuAz: 0.98,
          mpuTotalG: 0.99,
          mpuStatus: 'STABLE / NORMAL TRANSIT',
          distressSmsStatus: 'STANDBY (ARMED)',
          distressCallStatus: 'READY (AUTO-DIAL 112)'
        });
      }
    }

    renderTelemetry();
  } else {
    if (feedbackMsg) {
      feedbackMsg.textContent = 'Incorrect PIN! Default demo PIN is 1122';
      feedbackMsg.style.color = 'var(--crimson-500)';
    }
    if (window.tacticalAudio) window.tacticalAudio.playHeartbeatTick();
  }
}

function dispatchConfirmedSOS() {
  const modal = document.getElementById('emergencyCountdownModal');
  if (modal) modal.classList.remove('active');

  const settings = window.aegisState ? window.aegisState.getSettings() : {};
  const isAudible = settings.alarmMode === 'AUDIBLE_110DB';

  if (window.tacticalAudio) {
    if (isAudible) {
      window.tacticalAudio.startSOSAlarm();
    } else {
      window.tacticalAudio.playRadioSquelch();
    }
  }

  // Trigger state incident
  if (window.aegisState) {
    currentEmergencyIncident = window.aegisState.triggerSOS({
      triggerMethod: 'TACTILE_SQUEEZE_CONFIRMED',
      customNote: '15-second grace window elapsed. Priority CAD dispatch triggered via SIM800L.'
    });
  }

  const alertBanner = document.getElementById('activeSosBanner');
  if (alertBanner) {
    alertBanner.style.display = 'block';
    const incidentIdEl = document.getElementById('liveIncidentIdSpan');
    if (incidentIdEl && currentEmergencyIncident) {
      incidentIdEl.textContent = currentEmergencyIncident.id;
    }
  }

  renderTelemetry();
}

function setupWalkWithMe() {
  const startBtn = document.getElementById('startWalkBtn');
  const timerDisplay = document.getElementById('walkTimerDisplay');
  const checkinBtn = document.getElementById('walkCheckinBtn');
  const statusBadge = document.getElementById('walkStatusBadge');

  if (!startBtn) return;

  startBtn.addEventListener('click', () => {
    const isRunning = startBtn.getAttribute('data-running') === 'true';

    if (isRunning) {
      // Stop Walk
      clearInterval(walkInterval);
      startBtn.setAttribute('data-running', 'false');
      startBtn.innerHTML = '<i data-lucide="play"></i><span>Start "Walk With Me" Escort</span>';
      if (statusBadge) {
        statusBadge.textContent = 'STANDBY';
        statusBadge.className = 'badge badge-slate';
      }
      if (timerDisplay) timerDisplay.textContent = '25:00';
      if (checkinBtn) checkinBtn.style.display = 'none';
      if (window.tacticalAudio) window.tacticalAudio.playConfirm();
    } else {
      // Start Walk
      startBtn.setAttribute('data-running', 'true');
      startBtn.innerHTML = '<i data-lucide="square"></i><span>End Escort Safe</span>';
      walkSeconds = 1500;
      if (statusBadge) {
        statusBadge.textContent = 'ACTIVE ESCORT';
        statusBadge.className = 'badge badge-emerald';
      }
      if (checkinBtn) checkinBtn.style.display = 'inline-flex';

      if (window.tacticalAudio) window.tacticalAudio.playRadioSquelch();

      walkInterval = setInterval(() => {
        walkSeconds--;
        const m = Math.floor(walkSeconds / 60);
        const s = walkSeconds % 60;
        if (timerDisplay) {
          timerDisplay.textContent = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
        }

        if (walkSeconds <= 0) {
          clearInterval(walkInterval);
          startEmergencyCountdown();
        }
      }, 1000);
    }
    if (window.lucide) window.lucide.createIcons();
  });

  if (checkinBtn) {
    checkinBtn.addEventListener('click', () => {
      // Reset timer back by 10 mins
      walkSeconds = Math.min(1500, walkSeconds + 600);
      if (window.tacticalAudio) window.tacticalAudio.playClick();
      alert('Safety Check-In Confirmed. Escort extended.');
    });
  }
}

function setupModeToggles() {
  const silentRadio = document.getElementById('modeSilentRadio');
  const audibleRadio = document.getElementById('modeAudibleRadio');

  if (silentRadio && audibleRadio) {
    silentRadio.addEventListener('change', () => {
      if (window.aegisState) window.aegisState.updateSettings({ alarmMode: 'SILENT_DURESS' });
      if (window.tacticalAudio) window.tacticalAudio.playClick();
    });
    audibleRadio.addEventListener('change', () => {
      if (window.aegisState) window.aegisState.updateSettings({ alarmMode: 'AUDIBLE_110DB' });
      if (window.tacticalAudio) window.tacticalAudio.playClick();
    });
  }

  // Deactivate active SOS banner button
  const disarmActiveBtn = document.getElementById('disarmActiveSosBtn');
  if (disarmActiveBtn) {
    disarmActiveBtn.addEventListener('click', () => {
      const pin = prompt('Enter 4-Digit Emergency PIN to disarm live SOS:');
      if (pin === '1122') {
        if (window.tacticalAudio) {
          window.tacticalAudio.stopSOSAlarm();
          window.tacticalAudio.playConfirm();
        }
        const alertBanner = document.getElementById('activeSosBanner');
        if (alertBanner) alertBanner.style.display = 'none';
        if (window.aegisState) {
          if (currentEmergencyIncident) {
            window.aegisState.cancelSOS(currentEmergencyIncident.id, '1122');
            currentEmergencyIncident = null;
          } else {
            window.aegisState.updateTelemetry({
              stressLevel: 'NORMAL',
              mpuAx: 0.04,
              mpuAy: -0.02,
              mpuAz: 0.98,
              mpuTotalG: 0.99,
              mpuStatus: 'STABLE / NORMAL TRANSIT',
              distressSmsStatus: 'STANDBY (ARMED)',
              distressCallStatus: 'READY (AUTO-DIAL 112)'
            });
          }
        }
        renderTelemetry();
        alert('Live SOS Disarmed. Status set to SAFE.');
      } else if (pin !== null) {
        alert('Incorrect PIN! Default demo PIN is 1122');
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
