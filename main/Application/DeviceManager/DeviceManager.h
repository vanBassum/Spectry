#pragma once

#include "ServiceProvider.h"
#include "InitState.h"
#include "Led.h"
#include "As7341.h"

class DeviceManager
{
    static constexpr const char *TAG = "DeviceManager";

public:
    explicit DeviceManager(ServiceProvider &serviceProvider);

    DeviceManager(const DeviceManager &) = delete;
    DeviceManager &operator=(const DeviceManager &) = delete;
    DeviceManager(DeviceManager &&) = delete;
    DeviceManager &operator=(DeviceManager &&) = delete;

    void Init();

    Led &getLed() { return led_; }
    As7341 &getAs7341() { return as7341_; }

private:
    ServiceProvider &serviceProvider_;
    InitState initState_;

    // Hardware instances
    Led led_;
    As7341 as7341_;
};
