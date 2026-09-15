namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Platform secure storage abstraction (real impl in the MAUI head project
// wraps Microsoft.Maui.Storage.SecureStorage) so LoginViewModel etc. are
// testable without any MAUI runtime dependency.
public interface ITokenStore
{
    Task SaveTokenAsync(string token);
    Task<string?> GetTokenAsync();
    Task ClearTokenAsync();
}
