using UrbanAdmin.Tenant.Mobile.Core.Services;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.Services;

public class DeviceRegistrationServiceTests
{
    [Fact]
    public async Task RegisterCurrentDeviceAsync_RegistersWhenAPushTokenIsAvailable()
    {
        var apiClient = new FakeTenantApiClient();
        var pushTokenProvider = new FakePushTokenProvider("fcm-token-abc", "Android");
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider);

        await service.RegisterCurrentDeviceAsync("auth-jwt");

        Assert.NotNull(apiClient.RegisteredDevice);
        Assert.Equal(("auth-jwt", "Android", "fcm-token-abc"), apiClient.RegisteredDevice);
    }

    [Fact]
    public async Task RegisterCurrentDeviceAsync_DoesNothingWhenNoPushTokenIsAvailableYet()
    {
        // spec.md edge case: no notification permission yet is not an error.
        var apiClient = new FakeTenantApiClient();
        var pushTokenProvider = new FakePushTokenProvider(null);
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider);

        await service.RegisterCurrentDeviceAsync("auth-jwt");

        Assert.Null(apiClient.RegisteredDevice);
    }
}
