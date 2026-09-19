using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// Backs the shared "Cuenta" screen (010-logout-biometric-login) - the app's first screen visible
// to both roles.
public class AccountViewModel(ITokenStore tokenStore, IBiometricCredentialStore biometricCredentialStore)
{
    // Reflects whether a fingerprint sign-in credential is currently stored for this device -
    // loaded via LoadFingerprintStateAsync() (the page calls this on OnAppearing, the same
    // pattern every other ViewModel's LoadAsync follows).
    public bool IsFingerprintEnabled { get; private set; }

    // FR-003/SC-004: logging out is a full end to the device's signed-in state, not just the
    // session token - clearing the biometric credential too means a lost/borrowed device can
    // never sign back in via a leftover fingerprint credential after a logout.
    public async Task LogoutAsync()
    {
        await tokenStore.ClearTokenAsync();
        await biometricCredentialStore.ClearCredentialAsync();
        IsFingerprintEnabled = false;
    }

    public async Task LoadFingerprintStateAsync()
    {
        IsFingerprintEnabled = await biometricCredentialStore.GetCredentialAsync() is not null;
    }

    // No server round-trip needed - the username/password were already proven valid by the login
    // that supplied them (research.md §4). Returns false only on a storage failure.
    public async Task<bool> EnableFingerprintSignInAsync(string username, string password)
    {
        try
        {
            await biometricCredentialStore.SaveCredentialAsync(username, password);
            IsFingerprintEnabled = true;
            return true;
        }
        catch
        {
            return false;
        }
    }

    // FR-009: independent of logging out - the session token (if any) is left untouched.
    public async Task DisableFingerprintSignInAsync()
    {
        await biometricCredentialStore.ClearCredentialAsync();
        IsFingerprintEnabled = false;
    }
}
