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
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore());

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
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore());

        await service.RegisterCurrentDeviceAsync("auth-jwt");

        Assert.Null(apiClient.RegisteredDevice);
    }

    // Converge finding F3: previously, only LoginPage's explicit call ever registered
    // a device - a token rotated by the OS after login (a normal FCM occurrence) was
    // never picked up until the next login. Subscribing to the provider's
    // TokenRefreshed event, per T027/contracts/tenant-api.md's "on login and on token
    // refresh", fixes that.
    [Fact]
    public async Task TokenRefreshed_ReRegistersWithTheStoredAuthTokenAndTheNewPushToken()
    {
        var apiClient = new FakeTenantApiClient();
        var pushTokenProvider = new FakePushTokenProvider("fcm-token-original", "iOS");
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("auth-jwt");
        _ = new DeviceRegistrationService(apiClient, pushTokenProvider, tokenStore);

        pushTokenProvider.RaiseTokenRefreshed("fcm-token-rotated");
        await Task.Delay(50); // the event handler is async void - let it complete

        Assert.Equal(("auth-jwt", "iOS", "fcm-token-rotated"), apiClient.RegisteredDevice);
    }

    [Fact]
    public async Task TokenRefreshed_DoesNothingWhenNotLoggedIn()
    {
        var apiClient = new FakeTenantApiClient();
        var pushTokenProvider = new FakePushTokenProvider("fcm-token-original");
        _ = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore());

        pushTokenProvider.RaiseTokenRefreshed("fcm-token-rotated");
        await Task.Delay(50);

        Assert.Null(apiClient.RegisteredDevice);
    }
}
