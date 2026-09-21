using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakeTenantApiClient : ITenantApiClient
{
    public string? TokenToReturn { get; set; }
    public List<NotificacionModel> Notificaciones { get; set; } = [];
    public List<PagoModel> Pagos { get; set; } = [];
    public bool ThrowOnGet { get; set; }
    public System.Net.HttpStatusCode? ThrowStatusCode { get; set; }
    public bool ThrowOnLogin { get; set; }
    public bool ThrowOnRegisterDevice { get; set; }
    public (string Token, string Platform, string PushToken)? RegisteredDevice { get; private set; }
    public (int? Month, int? Year)? LastGetPagosArgs { get; private set; }

    // 015-fix-fingerprint-reopen: a server that never answers, one that answers slowly, and the last credential sent.
    public bool LoginNeverCompletes { get; set; }
    public TimeSpan LoginDelay { get; set; }
    public (string Username, string Password)? LastLogin { get; private set; }

    public async Task<string?> LoginAsync(string username, string password)
    {
        LastLogin = (username, password);
        if (LoginNeverCompletes)
        {
            await new TaskCompletionSource<string?>().Task;
        }

        if (LoginDelay > TimeSpan.Zero)
        {
            await Task.Delay(LoginDelay);
        }

        return ThrowOnLogin ? throw new HttpRequestException("boom") : TokenToReturn;
    }

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
        ThrowOnGet ? throw new HttpRequestException("boom", null, ThrowStatusCode) : Task.FromResult(Notificaciones);

    public Task<List<PagoModel>> GetPagosAsync(string token, int? month = null, int? year = null)
    {
        if (ThrowOnGet)
        {
            throw new HttpRequestException("boom", null, ThrowStatusCode);
        }

        LastGetPagosArgs = (month, year);
        return Task.FromResult(Pagos);
    }

    public AlertasModel Alertas { get; set; } = new();
    public PerfilModel Perfil { get; set; } = new();
    public int GetAlertasCallCount { get; private set; }
    public int GetPerfilCallCount { get; private set; }
    public bool ThrowOnPerfil { get; set; }

    public Task<AlertasModel> GetAlertasAsync(string token)
    {
        GetAlertasCallCount++;
        return ThrowOnGet ? throw new HttpRequestException("boom", null, ThrowStatusCode) : Task.FromResult(Alertas);
    }

    public Task<PerfilModel> GetPerfilAsync(string token)
    {
        GetPerfilCallCount++;
        return ThrowOnPerfil ? throw new HttpRequestException("boom") : ThrowOnGet ? throw new HttpRequestException("boom", null, ThrowStatusCode) : Task.FromResult(Perfil);
    }
}
