using Maui.Biometric;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Services;

// Wraps Oscore.Maui.Biometric's IBiometricAuthentication (research.md §1) - the real
// implementation this app ships. Tests use the plain in-memory FakeBiometricAuthenticator
// instead (IBiometricAuthenticator has no MAUI dependency).
public class OscoreBiometricAuthenticator(IBiometricAuthentication biometricAuthentication) : IBiometricAuthenticator
{
    public async Task<bool> IsAvailableAsync() => await biometricAuthentication.IsAvailableAsync();

    public async Task<bool> AuthenticateAsync(string reason)
    {
        var request = new AuthenticationRequest("UrbanAdmin", reason);
        var result = await biometricAuthentication.AuthenticateAsync(request);
        return result.IsSuccessful;
    }
}
