# Spectry

A simple ESP32-C3 device that reads an AS7341 11-channel spectral sensor and shows the results on a small OLED display.

## Hardware

- **MCU**: ESP32-C3 "mini super board" (AliExpress) with integrated OLED
- **Sensor**: AS7341 spectral sensor (I2C)

## Wiring

The AS7341 module uses I2C. On the module, `D` = SDA (data) and `C` = SCL (clock).

| AS7341 | ESP32-C3    |
| ------ | ----------- |
| VIN    | 3V3         |
| GND    | GND         |
| D      | GPIO8 (SDA) |
| C      | GPIO9 (SCL) |

GPIO assignments are configurable in firmware — update if your board's OLED already occupies these pins.
