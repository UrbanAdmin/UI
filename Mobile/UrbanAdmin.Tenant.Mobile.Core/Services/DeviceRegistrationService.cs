namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Called on login (T027, via LoginPage) and whenever the platform issues a
// new/rotated FCM token (subscribed below) - registers it against the
// currently signed-in tenant account. Both DeviceRegistrationService and its
// IPushTokenProvider are app-lifetime singletons (MauiProgram.cs), so this
// subscription is never unsubscribed - there is nothing shorter-lived for it
// to outlive.
public class DeviceRegistrationService
{
    private readonly ITenantApiClient _apiClient;
    private readonly IPushTokenProvider _pushTokenProvider;
    private readonly ITokenStore _tokenStore;
    private readonly ICrashDiagnosticsService _diagnostics;

    public DeviceRegistrationService(ITenantApiClient apiClient, IPushTokenProvider pushTokenProvider, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
    {
        _apiClient = apiClient;
        _pushTokenProvider = pushTokenProvider;
        _tokenStore = tokenStore;
        _diagnostics = diagnostics;
        _pushTokenProvider.TokenRefreshed += OnTokenRefreshed;
    }

    public async Task RegisterCurrentDeviceAsync(string authToken)
    {
        var pushToken = await _pushTokenProvider.GetTokenAsync();
        if (pushToken is null)
        {
            // No push permission granted / token not issued yet - not an
            // error (spec.md edge case), simply nothing to register yet.
            return;
        }

        try
        {
            await _apiClient.RegisterDeviceAsync(authToken, _pushTokenProvider.Platform, pushToken);
        }
        catch
        {
            // 007-fix-device-registration-crash/FR-001: this used to propagate
            // uncaught through LoginPage's async void OnLoginClicked and crash
            // the app right after a successful login - now it's best-effort,
            // same tolerance as OnTokenRefreshed below; the tenant still gets
            // into the app, just without push notifications registered yet.
            _diagnostics.LogApiError("device-registration", null);
        }
    }

    private async void OnTokenRefreshed(string newPushToken)
    {
        try
        {
            var authToken = await _tokenStore.GetTokenAsync();
            if (authToken is null)
            {
                // Not logged in - nothing to register this rotated token against;
                // the next login's RegisterCurrentDeviceAsync call will pick up
                // whatever the token is by then.
                return;
            }

            await _apiClient.RegisterDeviceAsync(authToken, _pushTokenProvider.Platform, newPushToken);
        }
        catch
        {
            // Best-effort, same tolerance as a normal network hiccup elsewhere
            // in this app (e.g. PagosViewModel.LoadAsync) - a failed
            // re-registration isn't user-facing and isn't retried here, but the
            // next login or token rotation will try again.
            _diagnostics.LogApiError("device-registration", null);
        }
    }
}
