namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Platform secure storage abstraction for the opt-in fingerprint sign-in credential
// (010-logout-biometric-login) - mirrors ITokenStore exactly (real impl in the MAUI head project
// wraps Microsoft.Maui.Storage.SecureStorage) so AccountViewModel/LoginViewModel etc. are
// testable without any MAUI runtime dependency. Storing the actual password here (rather than a
// separate server-issued credential) was an explicit, deliberate choice - Clarifications §1.
public interface IBiometricCredentialStore
{
    Task SaveCredentialAsync(string username, string password);
    Task<(string Username, string Password)?> GetCredentialAsync();
    Task ClearCredentialAsync();
}
