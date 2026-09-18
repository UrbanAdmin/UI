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
}
