#include "HomeAssistantManager.h"
#include "MqttManager/MqttManager.h"
#include "DeviceManager/DeviceManager.h"
#include "As7341.h"
#include "JsonWriter.h"
#include "esp_log.h"
#include <cstring>
#include <cstdio>

namespace {

struct SpectrumChannel
{
    const char *objectId;   // HA unique_id suffix and topic segment
    const char *name;       // Display name in HA
    uint16_t As7341::Reading::*field;
};

constexpr SpectrumChannel kSpectrumChannels[] = {
    { "f1",    "F1 415nm", &As7341::Reading::f1 },
    { "f2",    "F2 445nm", &As7341::Reading::f2 },
    { "f3",    "F3 480nm", &As7341::Reading::f3 },
    { "f4",    "F4 515nm", &As7341::Reading::f4 },
    { "f5",    "F5 555nm", &As7341::Reading::f5 },
    { "f6",    "F6 590nm", &As7341::Reading::f6 },
    { "f7",    "F7 630nm", &As7341::Reading::f7 },
    { "f8",    "F8 680nm", &As7341::Reading::f8 },
    { "clear", "Clear",    &As7341::Reading::clear },
    { "nir",   "NIR 910nm", &As7341::Reading::nir },
};

constexpr uint32_t kSpectrumPublishIntervalMs = 30'000;

} // namespace

HomeAssistantManager::HomeAssistantManager(ServiceProvider &ctx)
    : serviceProvider_(ctx)
{
}

void HomeAssistantManager::Init()
{
    auto init = initState_.TryBeginInit();
    if (!init)
    {
        ESP_LOGW(TAG, "Already initialized or initializing");
        return;
    }

    auto &mqtt = serviceProvider_.getMqttManager();

    // ── LED light entity ─────────────────────────────────────

    mqtt.RegisterCommand("led", [this](const char *data, int len)
    {
        bool on = (len >= 2 && strncmp(data, "ON", 2) == 0);
        serviceProvider_.getDeviceManager().getLed().Set(on);
        PublishLedState();
    });

    mqtt.RegisterDiscovery([this]()
    {
        auto &mqtt = serviceProvider_.getMqttManager();

        mqtt.PublishEntityDiscovery("light", "led", [&mqtt](JsonWriter &json)
        {
            json.field("name", "LED");

            char topic[128];
            snprintf(topic, sizeof(topic), "%s/set/led", mqtt.GetBaseTopic());
            json.field("cmd_t", topic);

            snprintf(topic, sizeof(topic), "%s/led/state", mqtt.GetBaseTopic());
            json.field("stat_t", topic);

            json.field("pl_on", "ON");
            json.field("pl_off", "OFF");
        });

        PublishLedState();

        // ── AS7341 spectrum sensors ─────────────────────────

        for (const auto &ch : kSpectrumChannels)
        {
            mqtt.PublishEntityDiscovery("sensor", ch.objectId, [&mqtt, &ch](JsonWriter &json)
            {
                json.field("name", ch.name);

                char topic[128];
                snprintf(topic, sizeof(topic), "%s/spectrum/%s", mqtt.GetBaseTopic(), ch.objectId);
                json.field("stat_t", topic);

                json.field("unit_of_meas", "counts");
                json.field("stat_cla", "measurement");
                json.field("ic", "mdi:palette");
            });
        }

        // Publish once immediately so HA has values right after discovery.
        PublishSpectrum();
    });

    // Periodic spectrum publish (independent of MQTT's internal state timer so
    // we don't couple WiFi metrics cadence with sensor reads).
    spectrumTimer_.Init("ha_spec", pdMS_TO_TICKS(kSpectrumPublishIntervalMs), true);
    spectrumTimer_.SetHandler([this]() { PublishSpectrum(); });
    spectrumTimer_.Start();

    init.SetReady();
    ESP_LOGI(TAG, "Initialized");
}

void HomeAssistantManager::PublishLedState()
{
    bool on = serviceProvider_.getDeviceManager().getLed().IsOn();
    serviceProvider_.getMqttManager().Publish("led/state", on ? "ON" : "OFF", true);
}

void HomeAssistantManager::PublishSpectrum()
{
    auto &mqtt = serviceProvider_.getMqttManager();
    if (!mqtt.IsConnected())
        return;

    auto &sensor = serviceProvider_.getDeviceManager().getAs7341();
    if (!sensor.IsReady())
        return;

    As7341::Reading r = {};
    if (!sensor.ReadChannels(r))
    {
        ESP_LOGW(TAG, "Spectrum read failed, skipping publish");
        return;
    }

    for (const auto &ch : kSpectrumChannels)
    {
        char subtopic[32];
        snprintf(subtopic, sizeof(subtopic), "spectrum/%s", ch.objectId);

        char payload[8];
        snprintf(payload, sizeof(payload), "%u", r.*(ch.field));

        mqtt.Publish(subtopic, payload);
    }
}
