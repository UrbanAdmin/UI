using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakeBiometricCredentialStore : IBiometricCredentialStore
{
    private (string Username, string Password)? _credential;

    public Task SaveCredentialAsync(string username, string password)
    {
        _credential = (username, password);
        return Task.CompletedTask;
    }

    public Task<(string Username, string Password)?> GetCredentialAsync() => Task.FromResult(_credential);

    public Task ClearCredentialAsync()
    {
        _credential = null;
        return Task.CompletedTask;
    }
}
