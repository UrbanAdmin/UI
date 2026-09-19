using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Services;

// Wraps Microsoft.Maui.Storage.SecureStorage (Keychain on iOS, EncryptedSharedPreferences
// on Android) - the same encrypted-at-rest mechanism already trusted for the session token
// (SecureStorageTokenStore), under separate keys (010-logout-biometric-login FR-011). Tests use
// the plain in-memory FakeBiometricCredentialStore instead.
public class SecureStorageBiometricCredentialStore : IBiometricCredentialStore
{
    private const string UsernameKey = "biometric_username";
    private const string PasswordKey = "biometric_password";

    public async Task SaveCredentialAsync(string username, string password)
    {
        await SecureStorage.Default.SetAsync(UsernameKey, username);
        await SecureStorage.Default.SetAsync(PasswordKey, password);
    }

    public async Task<(string Username, string Password)?> GetCredentialAsync()
    {
        var username = await SecureStorage.Default.GetAsync(UsernameKey);
        var password = await SecureStorage.Default.GetAsync(PasswordKey);
        return username is not null && password is not null ? (username, password) : null;
    }

    public Task ClearCredentialAsync()
    {
        SecureStorage.Default.Remove(UsernameKey);
        SecureStorage.Default.Remove(PasswordKey);
        return Task.CompletedTask;
    }
}
