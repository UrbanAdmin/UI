using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Services;

// Wraps Microsoft.Maui.Storage.SecureStorage (Keychain on iOS, EncryptedSharedPreferences
// on Android) - the only ITokenStore implementation this app ships; tests use
// the plain in-memory FakeTokenStore instead (ITokenStore has no MAUI dependency).
public class SecureStorageTokenStore : ITokenStore
{
    private const string TokenKey = "tenant_auth_token";

    public Task SaveTokenAsync(string token) => SecureStorage.Default.SetAsync(TokenKey, token);

    public Task<string?> GetTokenAsync() => SecureStorage.Default.GetAsync(TokenKey);

    public Task ClearTokenAsync()
    {
        SecureStorage.Default.Remove(TokenKey);
        return Task.CompletedTask;
    }
}
