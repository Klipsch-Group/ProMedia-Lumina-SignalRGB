# ProMedia Lumina SignalRGB Plugin

Custom SignalRGB plugin for the **Klipsch ProMedia Lumina** speakers.

## Overview

This plugin enables direct HID lighting control for ProMedia Lumina in SignalRGB.

- Device name: `ProMedia Lumina`
- USB VID/PID: `0x18B5 / 0x0070`
- Protocol: HID, custom framed packets
- LED map: 12 LEDs total (6 left speaker, 6 right speaker)

## Features

- Canvas-based lighting control from SignalRGB effects
- Forced color mode
- Shutdown color setting
- Speaker components for layout control:
  - `Left Speaker` (3x2)
  - `Right Speaker` (3x2)
- Conflicting process hints for:
  - `KlipschControl.exe`

## LED Layout

Global canvas is `7x2` with a center gap:

- Left speaker: columns `0-2`
- Gap: column `3`
- Right speaker: columns `4-6`

Logical LED order:

1. Left Top 1
2. Left Top 2
3. Left Top 3
4. Left Bottom 1
5. Left Bottom 2
6. Left Bottom 3
7. Right Top 1
8. Right Top 2
9. Right Top 3
10. Right Bottom 1
11. Right Bottom 2
12. Right Bottom 3

## Installation

1. Place `ProMedia_Lumina.js` in your SignalRGB user plugin directory.
2. Restart SignalRGB (or reload plugins).
3. Select **ProMedia Lumina** in Devices.
4. Set `Lighting Mode` to:
   - `Canvas` for effect-driven control
   - `Forced` for static selected color

## Configuration

Exposed user properties:

- `shutdownColor`
- `LightingMode` (`Canvas` / `Forced`)
- `forcedColor`
