namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Called on login and whenever the platform issues a new/rotated FCM token
// (T027) - registers it against the currently signed-in tenant account.
public class DeviceRegistrationService(ITenantApiClient apiClient, IPushTokenProvider pushTokenProvider)
{
    public async Task RegisterCurrentDeviceAsync(string authToken)
    {
        var pushToken = await pushTokenProvider.GetTokenAsync();
        if (pushToken is null)
        {
            // No push permission granted / token not issued yet - not an
            // error (spec.md edge case), simply nothing to register yet.
            return;
        }

        await apiClient.RegisterDeviceAsync(authToken, pushTokenProvider.Platform, pushToken);
    }
}
