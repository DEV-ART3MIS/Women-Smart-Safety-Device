/**
 * AEGIS-CORE : Home Page Interactive Controller
 * Updated for the Smart Women Safety Device (Powerbank Style Enclosure: 10cm x 6cm x 5cm)
 * Featuring ESP32 DevKit V1, SIM800L, NEO-6M, MPU6050, MAX9814, OLED, MicroSD, and 18650 Power Architecture
 */

document.addEventListener('DOMContentLoaded', () => {
  initTeardownViewer();
  initSimulator();
  initSchematicTabs();
  init3DControls();
});

// Real IoT Hardware Component Data from Official Engineering Schematic
const COMPONENT_DATA = {
  esp32: {
    title: 'ESP32 DevKit V1 (Main Dual-Core MCU)',
    specs: 'Xtensa Dual-Core 32-bit LX6 @ 240 MHz, 520 KB SRAM, Integrated Wi-Fi & BLE',
    role: 'The primary central computing brain managing dual hardware UARTs (GPS & GSM), high-speed I2C (MPU6050 & OLED), SPI bus (MicroSD), ADC audio sampling, and emergency interrupt routines.',
    badge: 'Main Controller',
    pins: 'GPIO 21, 22, 16, 17, 26, 27, 35, 5, 23, 19, 18, 34, 25'
  },
  gsm: {
    title: 'SIM800L GSM / GPRS Module',
    specs: 'Quad-band 850/900/1800/1900 MHz, Class 12 GPRS, Integrated SIM Slot',
    role: 'Handles rapid out-of-band cellular transmission. Dispatches emergency SMS with live Google Maps coordinates and opens an autonomous voice call channel to Police Command ERSS-112.',
    badge: 'Cellular Uplink',
    pins: 'TX -> GPIO 26, RX -> GPIO 27 (Hardware UART2)'
  },
  gps: {
    title: 'NEO-6M GPS Satellite Navigation Module',
    specs: '50-channel u-blox 6 engine, 2.5m CEP horizontal accuracy, Ceramic Patch Antenna',
    role: 'Acquires precise real-time latitude, longitude, altitude, and velocity. Operates with onboard EEPROM to save satellite ephemeris data for rapid 1-second hot fixes.',
    badge: 'Satellite GNSS',
    pins: 'TX -> GPIO 17, RX -> GPIO 16 (Hardware UART1)'
  },
  mpu: {
    title: 'MPU6050 6-Axis Motion & Fall Sensor',
    specs: '3-axis MEMS Accelerometer + 3-axis Gyroscope with Digital Motion Processor (DMP)',
    role: 'Detects physical assault dynamics, sudden struggle shocks, physical strikes, and abrupt vertical drops/falls. Automatically escalates an SOS if an unconscious fall is detected.',
    badge: 'Motion & Fall Detection',
    pins: 'SDA -> GPIO 21, SCL -> GPIO 22 (Shared I2C Bus)'
  },
  oled: {
    title: '0.96" Monochrome I2C OLED Display',
    specs: '128 x 64 High-Contrast Yellow/Blue Pixels, SSD1306 Controller',
    role: 'Provides an instant tactical status HUD for the user: GPS Lock confirmation, GSM Signal status, 18650 Battery percentage, and System Ready / Armed status.',
    badge: 'Tactical Status HUD',
    pins: 'SDA -> GPIO 21, SCL -> GPIO 22 (Shared I2C Bus)'
  },
  mic: {
    title: 'MAX9814 Microphone Module with AGC',
    specs: 'Low-noise electret mic amplifier with 40dB/50dB/60dB Automatic Gain Control',
    role: 'Records high-clarity ambient audio evidence of threats, coercion, or attacker speech. Feeds analog waveform into ESP32 ADC1 for live transmission and blackbox backup.',
    badge: 'Audio Evidence',
    pins: 'OUT -> GPIO 35 (ADC1, Channel 7)'
  },
  sd: {
    title: 'MicroSD Card SPI Blackbox Module',
    specs: 'High-speed SPI Interface, formatted with 16GB FAT32 Storage',
    role: 'Functions as a tamper-proof flight-recorder / blackbox. Continuously logs high-frequency GPS breadcrumbs and raw audio recordings even when cellular networks are jammed or unavailable.',
    badge: 'Offline Blackbox',
    pins: 'CS -> GPIO 5, MOSI -> GPIO 23, MISO -> GPIO 19, SCK -> GPIO 18'
  },
  motor: {
    title: '3V Coin Vibration Motor & 2N2222 Driver',
    specs: 'Coreless flat motor, 2N2222 NPN Transistor, 1N4007 Flyback Diode Protection',
    role: 'Delivers a discreet, silent haptic pulse to the user upon SOS activation. Confirms that emergency packets have been transmitted without making any acoustic sound that alerts the attacker.',
    badge: 'Silent Haptic Pulse',
    pins: 'Driver Base -> GPIO 25 (Digital Out)'
  },
  battery: {
    title: '18650 Li-ion Cell (3.7V) + TP4056 + AMS1117',
    specs: '2600-3200 mAh High-Capacity Li-ion, Micro-USB 5V Charging, AMS1117-3.3V LDO',
    role: 'Powers the entire multi-sensor platform for up to 14 days on standby. The TP4056 handles 1A fast charging with overcharge/over-discharge cutoff circuits.',
    badge: 'Power Distribution',
    pins: '5V USB In -> TP4056 -> 3.7V Battery -> AMS1117 -> 3.3V System Rail'
  },
  enclosure: {
    title: 'Powerbank-Style Tactical Enclosure',
    specs: '10.0 cm (H) x 6.0 cm (W) x 5.0 cm (D) Matte Dark Impact-Resistant ABS Shell',
    role: 'Genius visual camouflage: completely disguised as an everyday portable phone charger. Attackers do not suspect it is a satellite emergency tracker, leaving it unconfiscated.',
    badge: 'Everyday Camouflage',
    pins: 'Tactile Red SOS Button -> GPIO 34 (Digital In)'
  }
};

let device3DInstance = null;

function init3DControls() {
  // Initialize 3D Viewer if container exists
  const container = document.getElementById('device3DContainer');
  if (container && window.initDevice3D) {
    device3DInstance = window.initDevice3D('device3DContainer');
  }

  // Toggle Cutaway Button
  const cutawayBtn = document.getElementById('btnToggleCutaway');
  if (cutawayBtn && device3DInstance) {
    cutawayBtn.addEventListener('click', () => {
      const isCut = device3DInstance.toggleCutaway();
      cutawayBtn.classList.toggle('active', isCut);
      cutawayBtn.innerHTML = isCut ? 
        '<i data-lucide="eye"></i><span>Cutaway: Transparent</span>' : 
        '<i data-lucide="eye-off"></i><span>Cutaway: Solid Shell</span>';
      lucide.createIcons();
      if (window.tacticalAudio) window.tacticalAudio.playClick();
    });
  }

  // Toggle Auto-Rotate Button
  const rotateBtn = document.getElementById('btnToggleRotate');
  if (rotateBtn && device3DInstance) {
    rotateBtn.addEventListener('click', () => {
      const isRot = device3DInstance.toggleAutoRotate();
      rotateBtn.classList.toggle('active', isRot);
      rotateBtn.innerHTML = isRot ? 
        '<i data-lucide="rotate-cw"></i><span>Auto-Rotate: ON</span>' : 
        '<i data-lucide="pause"></i><span>Auto-Rotate: OFF</span>';
      lucide.createIcons();
      if (window.tacticalAudio) window.tacticalAudio.playClick();
    });
  }

  // Reset View Button
  const resetBtn = document.getElementById('btnResetView');
  if (resetBtn && device3DInstance) {
    resetBtn.addEventListener('click', () => {
      device3DInstance.resetView();
      if (window.tacticalAudio) window.tacticalAudio.playClick();
    });
  }
}

function initTeardownViewer() {
  const hotspots = document.querySelectorAll('.component-selector-item');
  const titleEl = document.getElementById('teardownTitle');
  const specEl = document.getElementById('teardownSpecs');
  const roleEl = document.getElementById('teardownRole');
  const badgeEl = document.getElementById('teardownBadge');
  const pinsEl = document.getElementById('teardownPins');

  hotspots.forEach(item => {
    item.addEventListener('click', () => {
      const partKey = item.getAttribute('data-part');
      const data = COMPONENT_DATA[partKey];
      if (!data) return;

      hotspots.forEach(h => h.classList.remove('active'));
      item.classList.add('active');

      if (window.tacticalAudio) window.tacticalAudio.playClick();

      // Update inspector details
      if (titleEl) titleEl.textContent = data.title;
      if (specEl) specEl.textContent = data.specs;
      if (roleEl) roleEl.textContent = data.role;
      if (badgeEl) badgeEl.textContent = data.badge;
      if (pinsEl) pinsEl.textContent = data.pins;
    });
  });
}

function initSchematicTabs() {
  const tabs = document.querySelectorAll('.schematic-tab-btn');
  const panels = document.querySelectorAll('.schematic-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const activePanel = document.getElementById(targetId);
      if (activePanel) activePanel.classList.add('active');

      // Trigger 3D canvas resize if 3D tab opened
      if (targetId === 'tab-3d-model' && device3DInstance) {
        setTimeout(() => device3DInstance.onResize(), 100);
      }

      if (window.tacticalAudio) window.tacticalAudio.playClick();
    });
  });
}

function initSimulator() {
  const triggerBtn = document.getElementById('demoTriggerBtn');
  const statusOutput = document.getElementById('simulatorOutput');

  if (!triggerBtn || !statusOutput) return;

  triggerBtn.addEventListener('click', () => {
    const selectedMode = document.querySelector('input[name="simMode"]:checked')?.value || 'SILENT';

    if (window.tacticalAudio) {
      if (selectedMode === 'AUDIBLE') {
        window.tacticalAudio.startSOSAlarm();
        setTimeout(() => window.tacticalAudio.stopSOSAlarm(), 3000);
      } else {
        window.tacticalAudio.playRadioSquelch();
      }
    }

    statusOutput.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--crimson-500); border-radius: 8px; padding: 1.2rem; margin-top: 1rem; animation: fadeIn 0.3s ease;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <span class="badge badge-crimson">EMERGENCY TRIGGER EXECUTED (GPIO 34)</span>
          <span class="font-mono text-cyan" style="font-size: 0.8rem;">NEO-6M FIX: 28.5412° N, 77.2014° E</span>
        </div>
        <p style="font-size: 0.9rem; color: #F8FAFC; margin-bottom: 0.6rem;">
          <strong>Device:</strong> ESP32 DevKit V1 (Powerbank Form Factor) • <strong>Mode:</strong> ${selectedMode === 'SILENT' ? 'Silent Duress (Vibration motor GPIO 25 pulsed)' : '110dB Siren Alarm'}
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem; color: #94A3B8; font-family: var(--font-mono); background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 6px;">
          <div>✓ SIM800L: SMS packet dispatched</div>
          <div>✓ NEO-6M: Satellite fix locked</div>
          <div>✓ MAX9814: Audio buffer started</div>
          <div>✓ MicroSD: Blackbox log created</div>
          <div>✓ MPU6050: Motion tracking active</div>
          <div>✓ ERSS 112: Police CAD ticket armed</div>
        </div>
      </div>
    `;

    // Also notify state bus
    if (window.aegisState) {
      window.aegisState.triggerSOS({
        triggerMethod: 'ESP32_GPIO34_PUSH_BUTTON',
        customNote: 'Powerbank-style Device Hardware Button Trigger'
      });
    }
  });
}
