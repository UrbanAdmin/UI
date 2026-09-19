using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakeBiometricAuthenticator : IBiometricAuthenticator
{
    public bool Available { get; set; } = true;
    public bool AuthenticateResult { get; set; } = true;
    public string? LastReason { get; private set; }

    public Task<bool> IsAvailableAsync() => Task.FromResult(Available);

    public Task<bool> AuthenticateAsync(string reason)
    {
        LastReason = reason;
        return Task.FromResult(AuthenticateResult);
    }
}
