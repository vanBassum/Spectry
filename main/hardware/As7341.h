#pragma once

#include "BoardConfig.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include <cstdint>

// ──────────────────────────────────────────────────────────────
// AS7341 11-channel spectral sensor (I2C, 7-bit address 0x39).
// Minimal driver: creates its own I2C bus on BoardConfig::I2C_SDA/SCL,
// probes the device, verifies WHO_AM_I, and powers it on.
// Channel readout (F1-F8 + Clear + NIR) requires SMUX programming —
// not yet implemented; add when measurements are needed.
// ──────────────────────────────────────────────────────────────

class As7341
{
    static constexpr const char* TAG = "As7341";

    static constexpr uint8_t  I2C_ADDR     = 0x39;
    static constexpr uint32_t I2C_SPEED_HZ = 400'000;

    static constexpr uint8_t REG_ENABLE = 0x80;
    static constexpr uint8_t REG_ID     = 0x92;

    // AS7341 ID register: bits [7:2] == 0b001001 (→ 0x24 when masked with 0xFC).
    static constexpr uint8_t ID_MASK  = 0xFC;
    static constexpr uint8_t ID_VALUE = 0x24;

    static constexpr uint8_t ENABLE_PON = 0x01;

public:
    As7341() = default;

    ~As7341()
    {
        if (dev_) i2c_master_bus_rm_device(dev_);
        if (bus_) i2c_del_master_bus(bus_);
    }

    As7341(const As7341&) = delete;
    As7341& operator=(const As7341&) = delete;
    As7341(As7341&&) = delete;
    As7341& operator=(As7341&&) = delete;

    bool Init()
    {
        i2c_master_bus_config_t bus_cfg = {};
        bus_cfg.i2c_port = I2C_NUM_0;
        bus_cfg.sda_io_num = static_cast<gpio_num_t>(BoardConfig::I2C_SDA_PIN);
        bus_cfg.scl_io_num = static_cast<gpio_num_t>(BoardConfig::I2C_SCL_PIN);
        bus_cfg.clk_source = I2C_CLK_SRC_DEFAULT;
        bus_cfg.glitch_ignore_cnt = 7;
        bus_cfg.flags.enable_internal_pullup = true;

        esp_err_t err = i2c_new_master_bus(&bus_cfg, &bus_);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "i2c_new_master_bus failed: %s", esp_err_to_name(err));
            return false;
        }

        i2c_device_config_t dev_cfg = {};
        dev_cfg.dev_addr_length = I2C_ADDR_BIT_LEN_7;
        dev_cfg.device_address  = I2C_ADDR;
        dev_cfg.scl_speed_hz    = I2C_SPEED_HZ;

        err = i2c_master_bus_add_device(bus_, &dev_cfg, &dev_);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "i2c_master_bus_add_device failed: %s", esp_err_to_name(err));
            return false;
        }

        uint8_t id = 0;
        if (!ReadReg(REG_ID, id)) {
            ESP_LOGE(TAG, "Failed to read ID register (sensor not responding)");
            return false;
        }
        if ((id & ID_MASK) != ID_VALUE) {
            ESP_LOGE(TAG, "Unexpected ID 0x%02x (expected 0x24)", id);
            return false;
        }

        if (!WriteReg(REG_ENABLE, ENABLE_PON)) {
            ESP_LOGE(TAG, "Failed to power on sensor");
            return false;
        }

        ESP_LOGI(TAG, "AS7341 detected, ID=0x%02x, powered on", id);
        return true;
    }

private:
    bool WriteReg(uint8_t reg, uint8_t value)
    {
        const uint8_t buf[2] = { reg, value };
        return i2c_master_transmit(dev_, buf, sizeof(buf), 100) == ESP_OK;
    }

    bool ReadReg(uint8_t reg, uint8_t& out)
    {
        return i2c_master_transmit_receive(dev_, &reg, 1, &out, 1, 100) == ESP_OK;
    }

    i2c_master_bus_handle_t bus_ = nullptr;
    i2c_master_dev_handle_t dev_ = nullptr;
};
