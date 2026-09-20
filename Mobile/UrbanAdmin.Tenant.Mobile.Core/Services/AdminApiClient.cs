using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Same construction shape as TenantApiClient: a shared HttpClient singleton, every method
// takes an explicit token and sets it as a per-request Bearer header
// (specs/008-mobile-admin-views/research.md §7).
public class AdminApiClient(HttpClient httpClient) : IAdminApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<List<ApartmentModel>> GetApartmentsAsync(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/Apartments");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<ApartmentModel>>(JsonOptions);
        return result ?? [];
    }

    public Task<AdminWriteResult> CreateApartmentAsync(string token, string name, string owner, DateTime? contractStartDate, string status) =>
        PostOrPutApartmentAsync(token, HttpMethod.Post, "/Apartments", name, owner, contractStartDate, status);

    public Task<AdminWriteResult> UpdateApartmentAsync(string token, long apartmentId, string name, string owner, DateTime? contractStartDate, string status) =>
        PostOrPutApartmentAsync(token, HttpMethod.Put, $"/Apartment/{apartmentId}", name, owner, contractStartDate, status);

    private async Task<AdminWriteResult> PostOrPutApartmentAsync(string token, HttpMethod method, string path, string name, string owner, DateTime? contractStartDate, string status)
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(new { Name = name, Owner = owner, ContractStartDate = contractStartDate, Status = status }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            return new AdminWriteResult(true, null);
        }

        var error = await response.Content.ReadFromJsonAsync<string>(JsonOptions);
        return new AdminWriteResult(false, error);
    }

    public async Task DeleteApartmentAsync(string token, long apartmentId)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/Apartment/{apartmentId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }

    public async Task UploadContractAsync(string token, long apartmentId, string fileName, string contentType, Stream content)
    {
        using var multipart = new MultipartFormDataContent();
        var streamContent = new StreamContent(content);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        multipart.Add(streamContent, "file", fileName);

        var request = new HttpRequestMessage(HttpMethod.Post, $"/Apartments/{apartmentId}/Contract")
        {
            Content = multipart,
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }

    public async Task<(byte[] Content, string ContentType, string FileName)?> DownloadContractAsync(string token, long apartmentId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, $"/Apartments/{apartmentId}/Contract");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();
        var bytes = await response.Content.ReadAsByteArrayAsync();
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
        var fileName = response.Content.Headers.ContentDisposition?.FileName?.Trim('"') ?? "contract";
        return (bytes, contentType, fileName);
    }

    public async Task<List<UserModel>> GetUsersAsync(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/Users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<UserModel>>(JsonOptions);
        return result ?? [];
    }

    public Task<AdminWriteResult> CreateUserAsync(string token, string username, string password, string role, long? apartmentId) =>
        PostOrPutUserAsync(token, HttpMethod.Post, "/Users", new { Username = username, Password = password, Role = role, ApartmentId = apartmentId });

    public Task<AdminWriteResult> UpdateUserAsync(string token, long userId, string role, long? apartmentId, string? newPassword) =>
        PostOrPutUserAsync(token, HttpMethod.Put, $"/User/{userId}", new { Role = role, ApartmentId = apartmentId, NewPassword = newPassword });

    private async Task<AdminWriteResult> PostOrPutUserAsync(string token, HttpMethod method, string path, object body)
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            return new AdminWriteResult(true, null);
        }

        var error = await response.Content.ReadFromJsonAsync<string>(JsonOptions);
        return new AdminWriteResult(false, error);
    }

    public async Task DeleteUserAsync(string token, long userId)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/User/{userId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }

    public async Task<List<AdminPagoRowModel>> GetAdminPagosAsync(string token, long? apartmentId, int? month, int? year, string? service = null)
    {
        var query = new List<string>();
        if (apartmentId is not null)
        {
            query.Add($"apartmentId={apartmentId}");
        }

        if (month is not null)
        {
            query.Add($"month={month}");
        }

        if (year is not null)
        {
            query.Add($"year={year}");
        }

        if (!string.IsNullOrEmpty(service))
        {
            query.Add($"service={Uri.EscapeDataString(service)}");
        }

        var path = query.Count > 0 ? $"/admin/pagos?{string.Join('&', query)}" : "/admin/pagos";
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<AdminPagoRowModel>>(JsonOptions);
        return result ?? [];
    }

    public async Task<List<AdminNotificationRowModel>> GetAdminNotificacionesAsync(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/admin/notificaciones");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<AdminNotificationRowModel>>(JsonOptions);
        return result ?? [];
    }

    public async Task<List<UtilityModel>> GetUtilitiesAsync(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/Utilities");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<List<UtilityModel>>(JsonOptions);
        return result ?? [];
    }

    public async Task<AdminWriteResult> SetAdminPagoPaymentAsync(string token, long apartmentId, string service, int month, int year, string? amount, bool paid)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, "/admin/pagos/payment")
        {
            Content = JsonContent.Create(new { ApartmentId = apartmentId, Service = service, Month = month, Year = year, Amount = amount, Paid = paid }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            return new AdminWriteResult(true, null);
        }

        var error = await response.Content.ReadFromJsonAsync<string>(JsonOptions);
        return new AdminWriteResult(false, error);
    }

    public async Task<AdminWriteResult> SetAdminPagoDeadlineAsync(string token, string service, int month, int year, DateTime dueDate)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, "/admin/pagos/deadline")
        {
            Content = JsonContent.Create(new { Service = service, Month = month, Year = year, DueDate = dueDate }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            return new AdminWriteResult(true, null);
        }

        var error = await response.Content.ReadFromJsonAsync<string>(JsonOptions);
        return new AdminWriteResult(false, error);
    }

    public async Task<CarteraModel> GetCarteraAsync(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/admin/cartera");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CarteraModel>(JsonOptions);
        return result ?? new CarteraModel();
    }

    public async Task<CarteraNotifyResultModel> NotificarCarteraAsync(string token, long? apartmentId, int? month, int? year)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/admin/cartera/notificar")
        {
            Content = JsonContent.Create(new { ApartmentId = apartmentId, Month = month, Year = year }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CarteraNotifyResultModel>(JsonOptions);
        return result ?? new CarteraNotifyResultModel();
    }
}
