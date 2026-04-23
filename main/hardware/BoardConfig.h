#pragma once

// ──────────────────────────────────────────────────────────────
// Board configuration — hardware-specific pin assignments and constants.
// Edit this file to match your board or target MCU.
// ──────────────────────────────────────────────────────────────

namespace BoardConfig
{
    // LED
    // GPIO2 is the built-in LED on most ESP32 DevKit boards.
    // Set to -1 if the board has no LED.
    static constexpr int LED_PIN = 2;
    static constexpr bool LED_ACTIVE_HIGH = true;

    // I2C bus (shared by AS7341 spectral sensor and OLED display).
    // AS7341 breakout has onboard pullups; OLED modules typically do too.
    static constexpr int I2C_SDA_PIN = 8;
    static constexpr int I2C_SCL_PIN = 9;
}
