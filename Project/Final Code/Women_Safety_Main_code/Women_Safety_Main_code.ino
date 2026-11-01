
#define TINY_GSM_MODEM_SIM800

#include <TinyGsmClient.h>
#include <TinyGPS++.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// ---------------- SERIAL PORTS ----------------
#define SerialMon Serial
#define SerialAT Serial1
#define GPS_Serial Serial2

// ---------------- SIM800L PINS ----------------
#define MODEM_RX 16
#define MODEM_TX 17

// ---------------- GPS PINS ----------------
#define GPS_RX 26
#define GPS_TX 27

// ---------------- EXISTING COMPONENTS ----------------
#define SOS_BUTTON 4
#define BUZZER     25
#define RED_LED    33

// ---------------- NEW COMPONENT PINS ----------------
#define MIC_PIN    34
#define SD_CS      5

// ---------------- OLED SETTINGS ----------------
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_ADDRESS  0x3C

// ---------------- AUDIO SETTINGS ----------------
#define SAMPLE_RATE       8000
#define RECORD_SECONDS    10
#define RECORD_SAMPLES    (SAMPLE_RATE * RECORD_SECONDS)

// ---------------- EMERGENCY NUMBER ----------------
#define ADMIN_NUMBER "+919022979996"

// ---------------- OBJECTS ----------------
TinyGsm modem(SerialAT);
TinyGPSPlus gps;

Adafruit_SSD1306 display(
  SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1
);

Adafruit_MPU6050 mpu;
File audioFile;

// ---------------- SYSTEM VARIABLES ----------------
bool sosTriggered = false;
bool oledReady = false;
bool mpuReady = false;
bool sdReady = false;
bool modemReady = false;
bool motionDetected = false;

float accelerationMagnitude = 0.0;
float motionBaseline = 9.81;

unsigned long lastGPSPrint = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastMotionCheck = 0;
unsigned long lastMotionPrint = 0;

// Motion threshold: change in acceleration magnitude, m/s^2
const float MOTION_THRESHOLD = 3.0;

// ---------------- FUNCTION DECLARATIONS ----------------
void triggerSOS();
void updateGPS();
void updateMotion();
void updateDisplay();
void printGPSStatus();
bool recordAudio();
void writeWavHeader(File &file, uint32_t dataSize);
void writeLE16(File &file, uint16_t value);
void writeLE32(File &file, uint32_t value);
void writeAllWavHeader(File &file, uint32_t dataSize);
String createEmergencyMessage();

// =====================================================
// SETUP
// =====================================================
void setup() {
  SerialMon.begin(115200);

  pinMode(SOS_BUTTON, INPUT_PULLUP);
  pinMode(BUZZER, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(MIC_PIN, INPUT);

  digitalWrite(BUZZER, LOW);
  digitalWrite(RED_LED, LOW);

  SerialMon.println();
  SerialMon.println("================================");
  SerialMon.println("ESP32 GPS GSM SOS DEVICE");
  SerialMon.println("================================");

  // ---------------- I2C ----------------
  Wire.begin(21, 22);

  // ---------------- OLED ----------------
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    oledReady = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("ESP32 SOS DEVICE");
    display.println("----------------");
    display.println("Starting system...");
    display.display();
  } else {
    SerialMon.println("OLED initialization failed!");
  }

  // ---------------- MPU6050 ----------------
  if (mpu.begin()) {
    mpuReady = true;

    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

    SerialMon.println("MPU6050 Ready");
  } else {
    SerialMon.println("MPU6050 initialization failed!");
  }

  // ---------------- SD CARD ----------------
  SerialMon.println("Initializing SD card...");

  if (SD.begin(SD_CS)) {
    sdReady = true;
    SerialMon.println("SD card Ready");
  } else {
    SerialMon.println("SD card initialization failed!");
  }

  // ---------------- GPS ----------------
  GPS_Serial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  SerialMon.println("GPS UART Ready");

  // ---------------- SIM800L ----------------
  SerialAT.begin(9600, SERIAL_8N1, MODEM_RX, MODEM_TX);
  delay(3000);

  SerialMon.println("Initializing SIM800L...");

  if (modem.restart()) {
    SerialMon.println("SIM800L Initialized");

    SerialMon.print("Modem Info: ");
    SerialMon.println(modem.getModemInfo());

    SerialMon.println("Waiting for Network...");

    if (modem.waitForNetwork(60000L)) {
      SerialMon.println("Network Connected");
      modemReady = modem.isNetworkConnected();
    } else {
      SerialMon.println("Network Failed!");
    }
  } else {
    SerialMon.println("SIM800L initialization failed!");
  }

  SerialMon.println("System Ready");
  SerialMon.println("Waiting for SOS Button...");

  updateDisplay();
}

// =====================================================
// MAIN LOOP
// =====================================================
void loop() {
  updateGPS();
  updateMotion();

  if (millis() - lastGPSPrint >= 5000) {
    lastGPSPrint = millis();
    printGPSStatus();
  }

  if (millis() - lastDisplayUpdate >= 500) {
    lastDisplayUpdate = millis();
    updateDisplay();
  }

  // SOS button is active LOW
  if (digitalRead(SOS_BUTTON) == LOW && !sosTriggered) {
    delay(50);

    if (digitalRead(SOS_BUTTON) == LOW) {
      triggerSOS();
    }
  }

  // Allow another SOS after the button is released
  if (digitalRead(SOS_BUTTON) == HIGH) {
    sosTriggered = false;
  }
}

// =====================================================
// READ GPS DATA
// =====================================================
void updateGPS() {
  while (GPS_Serial.available()) {
    gps.encode(GPS_Serial.read());
  }
}

// =====================================================
// GPS SERIAL DEBUG
// =====================================================
void printGPSStatus() {
  SerialMon.println("\n----- GPS STATUS -----");

  if (gps.location.isValid()) {
    SerialMon.print("Latitude: ");
    SerialMon.println(gps.location.lat(), 6);

    SerialMon.print("Longitude: ");
    SerialMon.println(gps.location.lng(), 6);

    SerialMon.print("Satellites: ");
    SerialMon.println(gps.satellites.value());
  } else {
    SerialMon.println("Waiting for GPS Fix...");
  }

  SerialMon.println("----------------------");
}

// =====================================================
// MPU6050 MOTION DETECTION
// =====================================================
void updateMotion() {
  if (!mpuReady) {
    motionDetected = false;
    return;
  }

  if (millis() - lastMotionCheck < 100) {
    return;
  }

  lastMotionCheck = millis();

  sensors_event_t accel, gyro, temp;
  mpu.getEvent(&accel, &gyro, &temp);

  accelerationMagnitude = sqrt(
    accel.acceleration.x * accel.acceleration.x +
    accel.acceleration.y * accel.acceleration.y +
    accel.acceleration.z * accel.acceleration.z
  );

  // Compare acceleration magnitude against the
  // approximate stationary gravity magnitude.
  motionDetected =
    fabs(accelerationMagnitude - motionBaseline) >
    MOTION_THRESHOLD;

  if (millis() - lastMotionPrint >= 1000) {
    lastMotionPrint = millis();

    SerialMon.print("Acceleration magnitude: ");
    SerialMon.print(accelerationMagnitude, 2);
    SerialMon.print(" m/s^2 | Motion: ");
    SerialMon.println(motionDetected ? "DETECTED" : "STABLE");
  }
}

// =====================================================
// OLED DISPLAY
// =====================================================
void updateDisplay() {
  if (!oledReady) {
    return;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  display.println("GPS GSM SOS DEVICE");
  display.println("---------------------");

  display.print("GSM: ");
  display.println(
    modemReady ? "CONNECTED" : "NOT READY"
  );

  display.print("GPS: ");
  if (gps.location.isValid()) {
    display.println("FIX OK");
  } else {
    display.println("SEARCHING");
  }

  display.print("Motion: ");
  if (!mpuReady) {
    display.println("MPU ERROR");
  } else {
    display.println(motionDetected ? "DETECTED" : "STABLE");
  }

  display.print("SD: ");
  display.println(sdReady ? "READY" : "ERROR");

  if (gps.location.isValid()) {
    display.print("Lat:");
    display.println(gps.location.lat(), 4);

    display.print("Lon:");
    display.println(gps.location.lng(), 4);
  }

  display.println("SOS: Press button");

  display.display();
}

// =====================================================
// CREATE WAV HEADER
// =====================================================
void writeLE16(File &file, uint16_t value) {
  file.write((uint8_t)(value & 0xFF));
  file.write((uint8_t)((value >> 8) & 0xFF));
}

void writeLE32(File &file, uint32_t value) {
  file.write((uint8_t)(value & 0xFF));
  file.write((uint8_t)((value >> 8) & 0xFF));
  file.write((uint8_t)((value >> 16) & 0xFF));
  file.write((uint8_t)((value >> 24) & 0xFF));
}

void writeWavHeader(File &file, uint32_t dataSize) {
  file.seek(0);
  file.write((const uint8_t *)"RIFF", 4);
  writeLE32(file, 36 + dataSize);
  file.write((const uint8_t *)"WAVE", 4);

  file.write((const uint8_t *)"fmt ", 4);
  writeLE32(file, 16);
  writeLE16(file, 1);  // PCM format
  writeLE16(file, 1);  // Mono
  writeLE32(file, SAMPLE_RATE);
  writeLE32(file, SAMPLE_RATE);  // 8-bit mono byte rate
  writeLE16(file, 1);  // Block align
  writeLE16(file, 8);  // Bits per sample

  file.write((const uint8_t *)"data", 4);
  writeLE32(file, dataSize);
}

// Wrapper retained for clarity if the WAV header needs
// to be finalized after recording.
void writeAllWavHeader(File &file, uint32_t dataSize) {
  writeWavHeader(file, dataSize);
}

// =====================================================
// RECORD MICROPHONE AUDIO TO SD CARD
// =====================================================
bool recordAudio() {
  if (!sdReady) {
    SerialMon.println("Recording unavailable: SD card not ready");
    return false;
  }

  // Create a unique filename using millis().
  char filename[32];
  snprintf(filename, sizeof(filename),
           "/SOS_%lu.wav", (unsigned long)millis());

  audioFile = SD.open(filename, FILE_WRITE);

  if (!audioFile) {
    SerialMon.println("Could not create WAV file!");
    return false;
  }

  SerialMon.print("Recording audio: ");
  SerialMon.println(filename);

  if (oledReady) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.println("!!! SOS ALERT !!!");
    display.println("Recording audio...");
    display.println("Please wait");
    display.display();
  }

  // Reserve the WAV header; write samples after it.
  uint8_t emptyHeader[44] = {0};
  audioFile.write(emptyHeader, sizeof(emptyHeader));

  const uint32_t totalSamples = RECORD_SAMPLES;
  const uint32_t sampleIntervalUs = 1000000UL / SAMPLE_RATE;

  uint32_t nextSampleTime = micros();

  for (uint32_t i = 0; i < totalSamples; i++) {
    // Maintain a roughly 8 kHz sampling interval.
    while ((int32_t)(micros() - nextSampleTime) < 0) {
      // Busy wait for the next sample time.
    }

    nextSampleTime += sampleIntervalUs;

    int raw = analogRead(MIC_PIN);

    // Convert 12-bit ADC values to unsigned 8-bit PCM.
    uint8_t sample = (uint8_t)(raw >> 4);

    if (audioFile.write(sample) != 1) {
      SerialMon.println("SD write error during recording!");
      audioFile.close();
      return false;
    }
  }

  // Finalize WAV metadata.
  audioFile.seek(0);
  writeAllWavHeader(audioFile, totalSamples);
  audioFile.flush();
  audioFile.close();

  SerialMon.println("Audio recording saved successfully");
  SerialMon.print("Saved file: ");
  SerialMon.println(filename);

  return true;
}

// =====================================================
// BUILD EMERGENCY SMS
// =====================================================
String createEmergencyMessage() {
  String message;

  message += "EMERGENCY ALERT!\n";
  message += "I NEED HELP IMMEDIATELY.\n\n";

  if (gps.location.isValid() &&
      gps.satellites.value() >= 3) {
    message += "LOCATION:\n";
    message += "https://maps.google.com/?q=";
    message += String(gps.location.lat(), 6);
    message += ",";
    message += String(gps.location.lng(), 6);
  } else {
    message += "GPS LOCATION NOT AVAILABLE";
  }

  message += "\n";

  if (motionDetected) {
    message += "Motion detected by MPU6050.\n";
  }

  message += "Check device SD card for audio recording.";

  return message;
}

// =====================================================
// SOS EMERGENCY FUNCTION
// =====================================================
void triggerSOS() {
  sosTriggered = true;

  SerialMon.println("\n================================");
  SerialMon.println("SOS BUTTON PRESSED");
  SerialMon.println("================================");

  // Immediate audible and visual alert.
  for (int i = 0; i < 30; i++) {
    digitalWrite(BUZZER, HIGH);
    digitalWrite(RED_LED, HIGH);
    delay(100);

    digitalWrite(BUZZER, LOW);
    digitalWrite(RED_LED, LOW);
    delay(100);
  }

  digitalWrite(BUZZER, HIGH);
  digitalWrite(RED_LED, HIGH);

  // Record audio before attempting SMS/call.
  // GPS reception pauses during this blocking operation.
  bool recordingSaved = recordAudio();

  // Build message after recording, using the last GPS fix.
  String message = createEmergencyMessage();

  if (recordingSaved) {
    message += "\nAudio recording saved on device.";
  } else {
    message += "\nAudio recording FAILED.";
  }

  // ---------------- SEND SMS ----------------
  bool smsSent = false;

  if (modemReady && modem.isNetworkConnected()) {
    for (int attempt = 1; attempt <= 3; attempt++) {
      SerialMon.print("SMS Attempt ");
      SerialMon.println(attempt);

      smsSent = modem.sendSMS(ADMIN_NUMBER, message);

      if (smsSent) {
        SerialMon.println("SMS Sent Successfully");
        break;
      }

      SerialMon.println("SMS Failed");
      delay(5000);
    }
  } else {
    SerialMon.println("SMS skipped: GSM network unavailable");
  }

  // ---------------- EMERGENCY CALL ----------------
  if (modemReady && modem.isNetworkConnected()) {
    SerialMon.println("Calling Emergency Number...");

    modem.callNumber(ADMIN_NUMBER);

    unsigned long callStart = millis();

    while (millis() - callStart < 30000UL) {
      digitalWrite(RED_LED, !digitalRead(RED_LED));
      delay(150);
    }

    modem.callHangup();
    SerialMon.println("Call Ended");
  } else {
    SerialMon.println("Call skipped: GSM network unavailable");
  }

  // ---------------- ALERT OFF ----------------
  digitalWrite(BUZZER, LOW);
  digitalWrite(RED_LED, LOW);

  SerialMon.println("Emergency Routine Completed");

  if (oledReady) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.println("SOS COMPLETED");
    display.print("SMS: ");
    display.println(smsSent ? "SENT" : "FAILED");
    display.print("Audio: ");
    display.println(recordingSaved ? "SAVED" : "FAILED");
    display.println("Release SOS button");
    display.display();
  }
}
