using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakeTokenStore : ITokenStore
{
    private string? _token;

    public Task SaveTokenAsync(string token)
    {
        _token = token;
        return Task.CompletedTask;
    }

    public Task<string?> GetTokenAsync() => Task.FromResult(_token);

    public Task ClearTokenAsync()
    {
        _token = null;
        return Task.CompletedTask;
    }
}
