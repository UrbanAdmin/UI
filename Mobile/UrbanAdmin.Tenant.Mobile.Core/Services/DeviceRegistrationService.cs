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

    public DeviceRegistrationService(ITenantApiClient apiClient, IPushTokenProvider pushTokenProvider, ITokenStore tokenStore)
    {
        _apiClient = apiClient;
        _pushTokenProvider = pushTokenProvider;
        _tokenStore = tokenStore;
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

        await _apiClient.RegisterDeviceAsync(authToken, _pushTokenProvider.Platform, pushToken);
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
        }
    }
}
