using System.Net.Http.Json;
using System.Text.Json;
using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.Services;

public class TenantApiClient(HttpClient httpClient) : ITenantApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<string?> LoginAsync(string username, string password)
    {
        var response = await httpClient.PostAsJsonAsync("/auth/login", new { username, password });
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var payload = await response.Content.ReadFromJsonAsync<LoginResponse>(JsonOptions);
        return payload?.Token;
    }

    public async Task RegisterDeviceAsync(string token, string platform, string pushToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/tenant/devices")
        {
            Content = JsonContent.Create(new { platform, pushToken }),
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }

    public async Task<List<NotificacionModel>> GetNotificacionesAsync(string token) =>
        await GetAsync<NotificacionModel>(token, "/tenant/notificaciones");

    public async Task<List<PagoModel>> GetPagosAsync(string token, int? month = null, int? year = null)
    {
        var query = new List<string>();
        if (month is not null)
        {
            query.Add($"month={month}");
        }

        if (year is not null)
        {
            query.Add($"year={year}");
        }

        var path = query.Count == 0 ? "/tenant/pagos" : $"/tenant/pagos?{string.Join('&', query)}";
        return await GetAsync<PagoModel>(token, path);
    }

    public async Task<AlertasModel> GetAlertasAsync(string token) =>
        await GetOneAsync<AlertasModel>(token, "/tenant/alertas") ?? new AlertasModel();

    public async Task<PerfilModel> GetPerfilAsync(string token) =>
        await GetOneAsync<PerfilModel>(token, "/tenant/perfil") ?? new PerfilModel();

    private async Task<T?> GetOneAsync<T>(string token, string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions);
    }

    private async Task<List<T>> GetAsync<T>(string token, string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<T>>(JsonOptions);
        return result ?? [];
    }

    private record LoginResponse(string? Token);
}
