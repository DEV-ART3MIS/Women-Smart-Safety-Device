/**
 * AEGIS-CORE : Shared Telemetry & State Bus
 * Powers real-time bi-directional synchronization between the Wearable Device,
 * the Woman's Personal Safety Dashboard, and the Police Officer CAD Center.
 */

const STORAGE_KEY_INCIDENTS = 'aegis_incidents';
const STORAGE_KEY_SETTINGS = 'aegis_user_settings';
const STORAGE_KEY_TELEMETRY = 'aegis_device_telemetry';

class AegisStateBus {
  constructor() {
    this.channel = null;
    try {
      this.channel = new BroadcastChannel('aegis_emergency_channel');
    } catch (e) {
      console.warn('BroadcastChannel not supported, falling back to storage events');
    }

    this.listeners = [];
    this.initDefaults();
    this.setupListeners();
  }

  initDefaults() {
    if (!localStorage.getItem(STORAGE_KEY_SETTINGS)) {
      const defaultSettings = {
        userName: 'Aanya Sharma',
        userAge: 23,
        bloodGroup: 'B+ Positive',
        emergencyPin: '1122',
        deviceSerial: 'AEGIS-X4-99824B',
        alarmMode: 'SILENT_DURESS', // or 'AUDIBLE_110DB'
        walkWithMeActive: false,
        walkTargetMinutes: 25,
        walkRemainingSeconds: 1500,
        contacts: [
          { name: 'Dr. Priya Sharma (Mother)', phone: '+91 98450 12384', priority: 'PRIMARY_CALL' },
          { name: 'Rohan Sharma (Brother)', phone: '+91 98450 99481', priority: 'SMS_ALERT' },
          { name: 'State Police Command (ERSS 112)', phone: '112', priority: 'POLICE_CAD' }
        ],
        safeZones: [
          { name: 'University Campus', radius: '800m', lat: 28.5450, lng: 77.1926, status: 'INSIDE' },
          { name: 'Home Residence (Sector 14)', radius: '350m', lat: 28.5355, lng: 77.2090, status: 'SAFE' },
          { name: 'Tech Park Metro Station', radius: '400m', lat: 28.5521, lng: 77.2185, status: 'MONITORED' }
        ]
      };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(defaultSettings));
    }

    if (!localStorage.getItem(STORAGE_KEY_TELEMETRY)) {
      const defaultTelemetry = {
        batteryPercent: 82,
        batteryVoltage: 3.94,
        batteryStatus: 'DISCHARGING / STANDBY',
        batteryTemp: '31.2°C',
        batteryCycles: 14,
        lat: 28.5412,
        lng: 77.2014,
        altitude: 216,
        satellites: 9,
        gpsFix: '3D FIX LOCKED',
        gpsAccuracy: '2.4m CEP (NEO-6M)',
        gpsSpeed: '0.0 km/h',
        mpuAx: 0.04,
        mpuAy: -0.02,
        mpuAz: 0.98,
        mpuGx: 0.8,
        mpuGy: -1.2,
        mpuGz: 0.1,
        mpuTotalG: 0.99,
        mpuStatus: 'STABLE / NORMAL TRANSIT',
        sim800lStatus: 'REGISTERED (HOME NETWORK)',
        sim800lSignalDbm: -78,
        sim800lCsq: 24,
        sim800lSimStatus: 'READY (PIN OK)',
        distressSmsStatus: 'STANDBY (ARMED)',
        distressCallStatus: 'READY (AUTO-DIAL 112)',
        sim800lLog: [
          'AT+CREG? -> +CREG: 0,1 [REGISTERED HOME NETWORK]',
          'AT+CSQ -> +CSQ: 24,0 [RSSI: -78dBm, EXCELLENT]',
          'AT+CGATT=1 -> GPRS NETWORK ATTACHED [OK]',
          'NEO-6M: $GPRMC VALID 3D SATELLITE FIX (9 SATS)',
          'SYSTEM READY: ARMED FOR GPIO 34 TACTILE TRIGGER'
        ],
        heartRateBpm: 76,
        stressLevel: 'NORMAL',
        lastSyncTime: new Date().toISOString(),
        wearableFirmware: 'v2.4.1 (ESP32 DevKit V1)'
      };
      localStorage.setItem(STORAGE_KEY_TELEMETRY, JSON.stringify(defaultTelemetry));
    }

    if (!localStorage.getItem(STORAGE_KEY_INCIDENTS)) {
      const defaultIncidents = [
        {
          id: 'CAD-DL-8839',
          timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
          victimName: 'Meera Iyer',
          age: 26,
          bloodGroup: 'O+',
          deviceModel: 'Aegis Halo Ring Mk.2',
          triggerType: 'HIGH_G_IMPACT_FALL',
          urgency: 'HIGH',
          status: 'ON_SCENE',
          lat: 28.5492,
          lng: 77.1980,
          locationName: 'Near Ring Road Underpass, South Ext.',
          assignedUnit: 'PCR Van Delta-09',
          officerName: 'Insp. R. Yadav',
          unitEta: '0 min (Arrived)',
          heartRateBpm: 94,
          audioRecorded: true,
          cctvCameraId: 'CCTV-STH-088-PTZ'
        },
        {
          id: 'CAD-DL-8824',
          timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
          victimName: 'Sneha Verma',
          age: 21,
          bloodGroup: 'A+',
          deviceModel: 'Aegis Core Locket v1',
          triggerType: 'GEOFENCE_DEVIATION_PANIC',
          urgency: 'RESOLVED',
          status: 'SECURED',
          lat: 28.5320,
          lng: 77.2140,
          locationName: 'Metro Pillar 142, Hauz Khas',
          assignedUnit: 'Pink Patrol Alpha-03',
          officerName: 'Sub-Insp. S. Kaur',
          unitEta: 'Completed',
          heartRateBpm: 78,
          audioRecorded: false,
          cctvCameraId: 'CCTV-HK-012'
        }
      ];
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(defaultIncidents));
    }
  }

  setupListeners() {
    if (this.channel) {
      this.channel.onmessage = (event) => {
        this.notify(event.data);
      };
    }

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY_INCIDENTS || e.key === STORAGE_KEY_TELEMETRY) {
        this.notify({ type: 'STORAGE_UPDATED', key: e.key });
      }
    });
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify(event) {
    this.listeners.forEach(cb => {
      try { cb(event); } catch(e) { console.error('Listener err', e); }
    });
  }

  broadcast(message) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
    this.notify(message);
  }

  // Getters & Updaters
  getSettings() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    this.broadcast({ type: 'SETTINGS_CHANGED', data: updated });
    return updated;
  }

  getTelemetry() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_TELEMETRY) || '{}');
  }

  updateTelemetry(fields) {
    const current = this.getTelemetry();
    const updated = { ...current, ...fields, lastSyncTime: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY_TELEMETRY, JSON.stringify(updated));
    this.broadcast({ type: 'TELEMETRY_UPDATED', data: updated });
    return updated;
  }

  getIncidents() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_INCIDENTS) || '[]');
  }

  // Trigger Emergency SOS from Woman's Device
  triggerSOS({ triggerMethod = 'MANUAL_CONCEALED_SQUEEZE', customNote = '' } = {}) {
    const settings = this.getSettings();
    const telemetry = this.getTelemetry();
    const incidents = this.getIncidents();

    // Spiking heart rate and MPU6050 shock during panic
    const panicBpm = Math.floor(Math.random() * 25) + 145;
    const currentLogs = telemetry.sim800lLog || [];
    const updatedLogs = [
      `>> EMERGENCY SOS TRIGGERED (GPIO 34) [${new Date().toLocaleTimeString()}] <<`,
      'SIM800L: AT+CMGS="+919845012384" -> SMS 1 TO MOTHER SENT',
      'SIM800L: AT+CMGS="112" -> EMERGENCY POLICE CAD PACKET SENT (ACK 200)',
      'SIM800L: ATD112; -> OPENING DUPLEX VOICE CHANNEL TO ERSS 112...',
      'MPU6050: HIGH ACCELERATION SPIKE DETECTED (2.85G IMPACT)',
      ...currentLogs.slice(0, 5)
    ];

    this.updateTelemetry({
      heartRateBpm: panicBpm,
      stressLevel: 'CRITICAL_PANIC',
      mpuAx: 1.45,
      mpuAy: 1.82,
      mpuAz: 1.62,
      mpuTotalG: 2.85,
      mpuStatus: 'ABRUPT IMPACT / VIOLENT STRUGGLE DETECTED (2.85G)',
      distressSmsStatus: 'DISPATCHED: POLICE 112 + 3 CONTACTS',
      distressCallStatus: 'CONNECTING VOICE CALL TO POLICE 112',
      sim800lLog: updatedLogs
    });

    const newIncident = {
      id: `CAD-DL-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      victimName: settings.userName || 'Aanya Sharma',
      age: settings.userAge || 23,
      bloodGroup: settings.bloodGroup || 'B+',
      deviceModel: 'Smart Safety Powerbank (ESP32 DevKit V1)',
      triggerType: triggerMethod,
      urgency: 'CRITICAL',
      status: 'UNACKNOWLEDGED',
      lat: telemetry.lat || 28.5412,
      lng: telemetry.lng || 77.2014,
      locationName: 'Near IIT Delhi Outer Ring Road, South Sector',
      assignedUnit: 'UNASSIGNED',
      officerName: 'Pending CAD Dispatch',
      unitEta: 'Calculating...',
      heartRateBpm: panicBpm,
      audioRecorded: true,
      cctvCameraId: 'CCTV-IIT-NORTH-04',
      customNote
    };

    incidents.unshift(newIncident);
    localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(incidents));

    this.broadcast({
      type: 'SOS_TRIGGERED',
      incident: newIncident
    });

    return newIncident;
  }

  // Cancel Emergency SOS (Within grace period with PIN)
  cancelSOS(incidentId, pin) {
    const settings = this.getSettings();
    if (pin !== settings.emergencyPin) {
      return { success: false, message: 'Invalid Emergency PIN. Grace cancel rejected.' };
    }

    const incidents = this.getIncidents();
    const target = incidents.find(inc => inc.id === incidentId);
    if (target) {
      target.status = 'CANCELLED_BY_USER';
      target.urgency = 'FALSE_ALARM';
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(incidents));
    }

    const currentLogs = this.getTelemetry().sim800lLog || [];
    const updatedLogs = [
      `>> EMERGENCY ALERT CANCELLED VIA PIN 1122 [${new Date().toLocaleTimeString()}] <<`,
      'SIM800L: AT+CMGS="112" -> CANCELLATION NOTICE TRANSMITTED',
      'SIM800L: ATH -> VOICE CALL TERMINATED. STANDBY RESUMED',
      ...currentLogs.slice(0, 5)
    ];

    this.updateTelemetry({
      heartRateBpm: 76,
      stressLevel: 'NORMAL',
      mpuAx: 0.04,
      mpuAy: -0.02,
      mpuAz: 0.98,
      mpuTotalG: 0.99,
      mpuStatus: 'STABLE / NORMAL TRANSIT',
      distressSmsStatus: 'STANDBY (ARMED)',
      distressCallStatus: 'READY (AUTO-DIAL 112)',
      sim800lLog: updatedLogs
    });

    this.broadcast({
      type: 'SOS_CANCELLED',
      incidentId
    });

    return { success: true, message: 'Emergency alert cancelled. Guardian circle notified.' };
  }

  // Police Officer Dispatch Action
  dispatchUnit(incidentId, unitName = 'PCR Van Bravo-12', officerName = 'Insp. K. Raman') {
    const incidents = this.getIncidents();
    const target = incidents.find(inc => inc.id === incidentId);
    if (target) {
      target.status = 'UNIT_DISPATCHED';
      target.assignedUnit = unitName;
      target.officerName = officerName;
      target.unitEta = '2.8 min (High Priority)';
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(incidents));

      this.broadcast({
        type: 'UNIT_DISPATCHED',
        incident: target
      });
      return target;
    }
    return null;
  }

  // Mark Incident On Scene or Secured
  updateIncidentStatus(incidentId, status, note = '') {
    const incidents = this.getIncidents();
    const target = incidents.find(inc => inc.id === incidentId);
    if (target) {
      target.status = status;
      if (note) target.incidentNotes = note;
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(incidents));
      this.broadcast({
        type: 'INCIDENT_STATUS_CHANGED',
        incident: target
      });
      return target;
    }
    return null;
  }
}

window.aegisState = new AegisStateBus();
