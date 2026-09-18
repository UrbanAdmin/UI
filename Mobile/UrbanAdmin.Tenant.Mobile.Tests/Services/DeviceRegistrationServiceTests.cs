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
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore(), new FakeCrashDiagnosticsService());

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
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore(), new FakeCrashDiagnosticsService());

        await service.RegisterCurrentDeviceAsync("auth-jwt");

        Assert.Null(apiClient.RegisteredDevice);
    }

    // 007-fix-device-registration-crash/FR-001: a device-registration failure (e.g. the
    // backend rejecting the call) must not crash the app - this call runs right after
    // login in an async void handler with no caller to catch it.
    [Fact]
    public async Task RegisterCurrentDeviceAsync_DoesNotThrowWhenTheApiCallFails()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnRegisterDevice = true };
        var pushTokenProvider = new FakePushTokenProvider("fcm-token-abc", "Android");
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore(), new FakeCrashDiagnosticsService());

        await service.RegisterCurrentDeviceAsync("auth-jwt");
    }

    // FR-002: the failure is still recorded as a diagnostic event even though it no
    // longer crashes.
    [Fact]
    public async Task RegisterCurrentDeviceAsync_LogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnRegisterDevice = true };
        var pushTokenProvider = new FakePushTokenProvider("fcm-token-abc", "Android");
        var diagnostics = new FakeCrashDiagnosticsService();
        var service = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore(), diagnostics);

        await service.RegisterCurrentDeviceAsync("auth-jwt");

        Assert.Equal([("device-registration", (int?)null)], diagnostics.ApiErrors);
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
        _ = new DeviceRegistrationService(apiClient, pushTokenProvider, tokenStore, new FakeCrashDiagnosticsService());

        pushTokenProvider.RaiseTokenRefreshed("fcm-token-rotated");
        await Task.Delay(50); // the event handler is async void - let it complete

        Assert.Equal(("auth-jwt", "iOS", "fcm-token-rotated"), apiClient.RegisteredDevice);
    }

    [Fact]
    public async Task TokenRefreshed_DoesNothingWhenNotLoggedIn()
    {
        var apiClient = new FakeTenantApiClient();
        var pushTokenProvider = new FakePushTokenProvider("fcm-token-original");
        _ = new DeviceRegistrationService(apiClient, pushTokenProvider, new FakeTokenStore(), new FakeCrashDiagnosticsService());

        pushTokenProvider.RaiseTokenRefreshed("fcm-token-rotated");
        await Task.Delay(50);

        Assert.Null(apiClient.RegisteredDevice);
    }

    // research.md §2: the same underlying operation, triggered by a rotated push token
    // instead of a fresh login, gets the same diagnostics treatment on failure.
    [Fact]
    public async Task TokenRefreshed_LogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnRegisterDevice = true };
        var pushTokenProvider = new FakePushTokenProvider("fcm-token-original");
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("auth-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        _ = new DeviceRegistrationService(apiClient, pushTokenProvider, tokenStore, diagnostics);

        pushTokenProvider.RaiseTokenRefreshed("fcm-token-rotated");
        await Task.Delay(50);

        Assert.Equal([("device-registration", (int?)null)], diagnostics.ApiErrors);
    }
}
