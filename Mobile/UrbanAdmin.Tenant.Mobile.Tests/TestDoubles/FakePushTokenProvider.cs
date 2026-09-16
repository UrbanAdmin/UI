using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakePushTokenProvider(string? token, string platform = "Android") : IPushTokenProvider
{
    public string Platform { get; } = platform;

    public Task<string?> GetTokenAsync() => Task.FromResult(token);

    public event Action<string>? TokenRefreshed;

    public void RaiseTokenRefreshed(string newToken) => TokenRefreshed?.Invoke(newToken);
}
