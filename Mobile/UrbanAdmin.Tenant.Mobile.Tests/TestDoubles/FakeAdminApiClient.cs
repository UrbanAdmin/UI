using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakeAdminApiClient : IAdminApiClient
{
    public List<ApartmentModel> Apartments { get; set; } = [];
    public bool ThrowOnGetApartments { get; set; }
    public bool ThrowOnCreateApartment { get; set; }
    public bool ThrowOnUpdateApartment { get; set; }
    public bool ThrowOnDeleteApartment { get; set; }
    public bool ThrowOnUploadContract { get; set; }
    public AdminWriteResult CreateApartmentResult { get; set; } = new(true, null);
    public AdminWriteResult UpdateApartmentResult { get; set; } = new(true, null);
    public (string Name, string Owner, DateTime? ContractStartDate, string Status)? LastCreatedApartment { get; private set; }
    public (long ApartmentId, string Name, string Owner, DateTime? ContractStartDate, string Status)? LastUpdatedApartment { get; private set; }
    public long? LastDeletedApartmentId { get; private set; }
    public (long ApartmentId, string FileName, string ContentType)? LastUploadedContract { get; private set; }

    public Task<List<ApartmentModel>> GetApartmentsAsync(string token) =>
        ThrowOnGetApartments ? throw new HttpRequestException("boom") : Task.FromResult(Apartments);

    public Task<AdminWriteResult> CreateApartmentAsync(string token, string name, string owner, DateTime? contractStartDate, string status)
    {
        if (ThrowOnCreateApartment)
        {
            throw new HttpRequestException("boom");
        }

        LastCreatedApartment = (name, owner, contractStartDate, status);
        return Task.FromResult(CreateApartmentResult);
    }

    public Task<AdminWriteResult> UpdateApartmentAsync(string token, long apartmentId, string name, string owner, DateTime? contractStartDate, string status)
    {
        if (ThrowOnUpdateApartment)
        {
            throw new HttpRequestException("boom");
        }

        LastUpdatedApartment = (apartmentId, name, owner, contractStartDate, status);
        return Task.FromResult(UpdateApartmentResult);
    }

    public Task DeleteApartmentAsync(string token, long apartmentId)
    {
        if (ThrowOnDeleteApartment)
        {
            throw new HttpRequestException("boom");
        }

        LastDeletedApartmentId = apartmentId;
        return Task.CompletedTask;
    }

    public Task UploadContractAsync(string token, long apartmentId, string fileName, string contentType, Stream content)
    {
        if (ThrowOnUploadContract)
        {
            throw new HttpRequestException("boom");
        }

        LastUploadedContract = (apartmentId, fileName, contentType);
        return Task.CompletedTask;
    }

    public Task<(byte[] Content, string ContentType, string FileName)?> DownloadContractAsync(string token, long apartmentId) =>
        Task.FromResult<(byte[] Content, string ContentType, string FileName)?>(null);

    public List<UserModel> Users { get; set; } = [];
    public bool ThrowOnGetUsers { get; set; }
    public bool ThrowOnCreateUser { get; set; }
    public bool ThrowOnUpdateUser { get; set; }
    public bool ThrowOnDeleteUser { get; set; }
    public AdminWriteResult CreateUserResult { get; set; } = new(true, null);
    public AdminWriteResult UpdateUserResult { get; set; } = new(true, null);
    public (string Username, string Password, string Role, long? ApartmentId)? LastCreatedUser { get; private set; }
    public (long UserId, string Role, long? ApartmentId, string? NewPassword)? LastUpdatedUser { get; private set; }
    public long? LastDeletedUserId { get; private set; }

    public Task<List<UserModel>> GetUsersAsync(string token) =>
        ThrowOnGetUsers ? throw new HttpRequestException("boom") : Task.FromResult(Users);

    public Task<AdminWriteResult> CreateUserAsync(string token, string username, string password, string role, long? apartmentId)
    {
        if (ThrowOnCreateUser)
        {
            throw new HttpRequestException("boom");
        }

        LastCreatedUser = (username, password, role, apartmentId);
        return Task.FromResult(CreateUserResult);
    }

    public Task<AdminWriteResult> UpdateUserAsync(string token, long userId, string role, long? apartmentId, string? newPassword)
    {
        if (ThrowOnUpdateUser)
        {
            throw new HttpRequestException("boom");
        }

        LastUpdatedUser = (userId, role, apartmentId, newPassword);
        return Task.FromResult(UpdateUserResult);
    }

    public Task DeleteUserAsync(string token, long userId)
    {
        if (ThrowOnDeleteUser)
        {
            throw new HttpRequestException("boom");
        }

        LastDeletedUserId = userId;
        return Task.CompletedTask;
    }
}
