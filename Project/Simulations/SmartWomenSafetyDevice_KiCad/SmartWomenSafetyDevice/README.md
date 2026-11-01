# Smart Women Safety Device — KiCad Project

This is a working **KiCad 7/8 schematic project** (schematic only, no PCB layout)
reconstructed from your board photo. Open `SmartWomenSafetyDevice.kicad_pro` in
KiCad — it will load the schematic and the project-local symbol library
(`SWSD.kicad_sym`) automatically.

## What's included
- `SmartWomenSafetyDevice.kicad_pro` — project file
- `SmartWomenSafetyDevice.kicad_sch` — schematic (18 parts, 33 nets)
- `SWSD.kicad_sym` — custom symbol library (one simple block symbol per module)
- `sym-lib-table` — project library table so the symbols resolve without warnings

Every part is wired using **global labels** (net names) instead of long routed
wires — this is standard practice for busy schematics and means ERC/netlist
generation works correctly; you can rearrange parts freely without breaking
connections.

## What's NOT included
Recreating your exact copper routing (the artistic red/blue trace paths) as a
`.kicad_pcb` isn't practical to hand-generate — PCB placement/routing is a
job for KiCad's placement and autorouter (or manual routing) once you're happy
with the schematic. I focused on getting an **electrically correct,
openable schematic** with the right connections between modules, which you can
then run through KiCad's "Update PCB from Schematic" to lay out the board.

## Pin mapping used (assumptions made from the photo)
Because exact GPIO-to-module wiring isn't fully legible from a photo, I used
standard/sensible ESP32 pin assignments where the image was ambiguous:

| Signal | ESP32 Pin | Notes |
|---|---|---|
| I2C SCL (OLED + MPU6050, shared bus) | D22 | ESP32 default I2C clock |
| I2C SDA (OLED + MPU6050, shared bus) | D21 | ESP32 default I2C data |
| MPU6050 INT | D27 | |
| GPS TX0→RX / RX0→TX | TX0 (GPIO1) / RX0 (GPIO3) | Hardware UART0 |
| SIM800L TX/RX | D16 / D17 | Hardware UART2 |
| SIM800L RST | D4 | |
| MAX9814 mic OUT | D35 | ADC1, input-only pin |
| SD card CS/SCK/MOSI/MISO | D5 / D18 / D23 / D19 | Standard VSPI pins |
| SOS button | D34 (to GND, use internal pull-up) | ADC1/input-only pin, matches your silkscreen label |
| Vibration motor driver base | D2 → 1k resistor → 2N2222 base | |
| D12, D14, D25, D26, D32, D33, D15, EN, VP, VN | Unused / spare | Left as no-connect flags |

**Power:** SIM800L VCC and the vibration motor are tied to `VBATT` (raw
battery ~3.7–4.2 V, downstream of the slide switch/TP4056), **not** the
3.3 V rail — SIM800L needs 3.7–4.2 V and can draw up to ~2 A in transmit
bursts, so give it its own thick trace/decoupling directly from the battery,
not through the AMS1117. Everything else (ESP32, OLED, MPU6050, GPS, mic, SD
card) runs from the AMS1117's regulated `P3V3` rail.

## Before you route the PCB
1. Double-check the GPIO assignments above against your actual firmware/wiring
   and correct the labels in the schematic if anything differs.
2. Add real manufacturer footprints to each symbol's "Footprint" field
   (currently blank) — e.g. the ESP32-DevKit footprint, SIM800L module
   footprint, 18650 holder footprint, etc. — before generating the PCB.
3. Run Eeschema's ERC (Inspect → Electrical Rules Checker) — the single-pin
   `NC_*` nets and `USB_5V` are expected warnings (unused GPIOs / external USB
   connector not modeled) and can be safely ignored or silenced.
4. Add a proper 5 V USB micro-B connector symbol ahead of `USB_5V`/TP4056 IN+
   if you want the charging input modeled explicitly.
