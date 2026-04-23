#include "DeviceManager.h"
#include "esp_log.h"

DeviceManager::DeviceManager(ServiceProvider &ctx)
    : serviceProvider_(ctx)
{
}

void DeviceManager::Init()
{
    auto init = initState_.TryBeginInit();
    if (!init)
    {
        ESP_LOGW(TAG, "Already initialized or initializing");
        return;
    }

    led_.Init();

    if (!as7341_.Init()) {
        ESP_LOGE(TAG, "AS7341 init failed — spectral readings unavailable");
    }

    init.SetReady();
    ESP_LOGI(TAG, "Initialized");
}
