using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakeTenantApiClient : ITenantApiClient
{
    public string? TokenToReturn { get; set; }
    public List<NotificacionModel> Notificaciones { get; set; } = [];
    public List<PagoModel> Pagos { get; set; } = [];
    public bool ThrowOnGet { get; set; }
    public bool ThrowOnLogin { get; set; }
    public bool ThrowOnRegisterDevice { get; set; }
    public (string Token, string Platform, string PushToken)? RegisteredDevice { get; private set; }

    public Task<string?> LoginAsync(string username, string password) =>
        ThrowOnLogin ? throw new HttpRequestException("boom") : Task.FromResult(TokenToReturn);

    public Task RegisterDeviceAsync(string token, string platform, string pushToken)
    {
        if (ThrowOnRegisterDevice)
        {
            throw new HttpRequestException("boom");
        }

        RegisteredDevice = (token, platform, pushToken);
        return Task.CompletedTask;
    }

    public Task<List<NotificacionModel>> GetNotificacionesAsync(string token) =>
        ThrowOnGet ? throw new HttpRequestException("boom") : Task.FromResult(Notificaciones);

    public Task<List<PagoModel>> GetPagosAsync(string token) =>
        ThrowOnGet ? throw new HttpRequestException("boom") : Task.FromResult(Pagos);
}
