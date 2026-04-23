#pragma once

#include "BoardConfig.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <cstdint>

// ──────────────────────────────────────────────────────────────
// AS7341 11-channel spectral sensor (I2C, 7-bit address 0x39).
// Owns its own I2C bus on BoardConfig::I2C_SDA/SCL.
// Integration: ATIME=29, ASTEP=599 → ~50 ms per SMUX config.
// ReadChannels() returns F1-F8 + Clear + NIR (2 back-to-back
// measurements with different SMUX mappings).
// ──────────────────────────────────────────────────────────────

class As7341
{
    static constexpr const char* TAG = "As7341";

    static constexpr uint8_t  I2C_ADDR     = 0x39;
    static constexpr uint32_t I2C_SPEED_HZ = 400'000;

    // Register map
    static constexpr uint8_t REG_ENABLE     = 0x80;
    static constexpr uint8_t REG_ATIME      = 0x81;
    static constexpr uint8_t REG_ID         = 0x92;
    static constexpr uint8_t REG_CH0_DATA_L = 0x95;
    static constexpr uint8_t REG_STATUS2    = 0xA3;
    static constexpr uint8_t REG_CFG_1      = 0xAA;  // AGAIN
    static constexpr uint8_t REG_CFG_6      = 0xAF;  // SMUX_CMD
    static constexpr uint8_t REG_ASTEP_L    = 0xCA;
    static constexpr uint8_t REG_ASTEP_H    = 0xCB;

    // ENABLE bits
    static constexpr uint8_t EN_PON    = 1 << 0;
    static constexpr uint8_t EN_SP_EN  = 1 << 1;
    static constexpr uint8_t EN_SMUXEN = 1 << 4;

    // CFG_6: SMUX_CMD bits [4:3]; value 2 = "write config from RAM"
    static constexpr uint8_t SMUX_CMD_WRITE = 0b0001'0000;

    // STATUS2 bits
    static constexpr uint8_t STATUS2_AVALID = 1 << 6;

    // ID register: bits [7:2] == 0b001001 → (id & 0xFC) == 0x24
    static constexpr uint8_t ID_MASK  = 0xFC;
    static constexpr uint8_t ID_VALUE = 0x24;

    // Default integration: (ATIME+1) * (ASTEP+1) * 2.78 µs = 30 * 600 * 2.78 µs ≈ 50 ms
    static constexpr uint8_t  DEF_ATIME = 29;
    static constexpr uint16_t DEF_ASTEP = 599;
    static constexpr uint8_t  DEF_AGAIN = 9;  // 256x — reasonable for indoor

public:
    static constexpr int ChannelCount = 10;

    struct Reading {
        uint16_t f1, f2, f3, f4, f5, f6, f7, f8, clear, nir;
    };

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

        if (!WriteReg(REG_ENABLE, EN_PON)) {
            ESP_LOGE(TAG, "Failed to power on");
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

        if (!WriteReg(REG_ATIME,   DEF_ATIME))            return false;
        if (!WriteReg(REG_ASTEP_L, DEF_ASTEP & 0xFF))     return false;
        if (!WriteReg(REG_ASTEP_H, (DEF_ASTEP >> 8) & 0xFF)) return false;
        if (!WriteReg(REG_CFG_1,   DEF_AGAIN))            return false;

        ready_ = true;
        ESP_LOGI(TAG, "AS7341 detected, ID=0x%02x, powered on", id);
        return true;
    }

    bool IsReady() const { return ready_; }

    bool ReadChannels(Reading& out)
    {
        if (!ready_) return false;

        uint16_t low[6]  = {};
        uint16_t high[6] = {};
        if (!MeasureWithSmux(SmuxLow,  low))  return false;
        if (!MeasureWithSmux(SmuxHigh, high)) return false;

        // SMUX mappings place each F-channel on a specific ADC slot.
        // Low set:  ADC0=F1, ADC1=F2, ADC2=F3, ADC3=F4, ADC4=Clear, ADC5=NIR
        // High set: ADC0=F5, ADC1=F6, ADC2=F7, ADC3=F8, ADC4=Clear, ADC5=NIR
        out.f1 = low[0];
        out.f2 = low[1];
        out.f3 = low[2];
        out.f4 = low[3];
        out.f5 = high[0];
        out.f6 = high[1];
        out.f7 = high[2];
        out.f8 = high[3];
        out.clear = low[4];
        out.nir   = low[5];
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

    bool SetBits(uint8_t reg, uint8_t bits)
    {
        uint8_t v = 0;
        if (!ReadReg(reg, v)) return false;
        return WriteReg(reg, v | bits);
    }

    bool ClearBits(uint8_t reg, uint8_t bits)
    {
        uint8_t v = 0;
        if (!ReadReg(reg, v)) return false;
        return WriteReg(reg, v & ~bits);
    }

    bool MeasureWithSmux(const uint8_t smux[20], uint16_t channels[6])
    {
        // SP must be off while SMUX is reconfigured.
        if (!ClearBits(REG_ENABLE, EN_SP_EN)) return false;

        // Write 20-byte SMUX mapping to RAM (regs 0x00-0x13).
        for (uint8_t i = 0; i < 20; i++) {
            if (!WriteReg(i, smux[i])) return false;
        }

        // Tell sensor to apply RAM to the SMUX chain.
        if (!WriteReg(REG_CFG_6, SMUX_CMD_WRITE)) return false;
        if (!SetBits(REG_ENABLE, EN_SMUXEN))      return false;

        // SMUXEN auto-clears when done (~1 ms typ); allow generous timeout.
        uint8_t enable = 0;
        for (int i = 0; i < 100; i++) {
            if (!ReadReg(REG_ENABLE, enable)) return false;
            if (!(enable & EN_SMUXEN)) break;
            vTaskDelay(pdMS_TO_TICKS(1));
        }
        if (enable & EN_SMUXEN) {
            ESP_LOGW(TAG, "SMUX apply timeout");
            return false;
        }

        // Start spectral measurement.
        if (!SetBits(REG_ENABLE, EN_SP_EN)) return false;

        // Wait for AVALID. Integration ~50 ms; give it ~400 ms headroom.
        uint8_t status = 0;
        for (int i = 0; i < 200; i++) {
            if (!ReadReg(REG_STATUS2, status)) return false;
            if (status & STATUS2_AVALID) break;
            vTaskDelay(pdMS_TO_TICKS(2));
        }
        if (!(status & STATUS2_AVALID)) {
            ESP_LOGW(TAG, "AVALID timeout (STATUS2=0x%02x)", status);
            return false;
        }

        // Read 6 channels × 2 bytes LE starting at CH0_DATA_L (0x95).
        uint8_t buf[12] = {};
        const uint8_t reg = REG_CH0_DATA_L;
        if (i2c_master_transmit_receive(dev_, &reg, 1, buf, sizeof(buf), 100) != ESP_OK) {
            return false;
        }

        for (int ch = 0; ch < 6; ch++) {
            channels[ch] = static_cast<uint16_t>(buf[ch * 2]) |
                           (static_cast<uint16_t>(buf[ch * 2 + 1]) << 8);
        }

        // Leave SP off until next measurement.
        ClearBits(REG_ENABLE, EN_SP_EN);
        return true;
    }

    // SMUX mappings from AS7341 app note / Adafruit reference driver.
    // Route each internal photodiode to one of ADC0..ADC5 for the current measurement.
    static constexpr uint8_t SmuxLow[20] = {
        0x30, 0x01, 0x00, 0x00, 0x00, 0x42, 0x00, 0x00, 0x50, 0x00,
        0x00, 0x00, 0x20, 0x04, 0x00, 0x30, 0x01, 0x50, 0x00, 0x06,
    };

    static constexpr uint8_t SmuxHigh[20] = {
        0x00, 0x00, 0x00, 0x40, 0x02, 0x00, 0x10, 0x03, 0x50, 0x10,
        0x03, 0x00, 0x00, 0x00, 0x24, 0x00, 0x00, 0x50, 0x00, 0x06,
    };

    i2c_master_bus_handle_t bus_ = nullptr;
    i2c_master_dev_handle_t dev_ = nullptr;
    bool ready_ = false;
};
