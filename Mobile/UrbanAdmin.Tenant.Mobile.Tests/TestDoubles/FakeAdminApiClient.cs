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

    public bool ThrowOnDownloadContract { get; set; }
    public (byte[] Content, string ContentType, string FileName)? DownloadContractResult { get; set; }
    public long? LastDownloadedContractApartmentId { get; private set; }

    public Task<(byte[] Content, string ContentType, string FileName)?> DownloadContractAsync(string token, long apartmentId)
    {
        if (ThrowOnDownloadContract)
        {
            throw new HttpRequestException("boom");
        }

        LastDownloadedContractApartmentId = apartmentId;
        return Task.FromResult(DownloadContractResult);
    }

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

    public List<AdminPagoRowModel> AdminPagos { get; set; } = [];
    public bool ThrowOnGetAdminPagos { get; set; }
    public List<AdminNotificationRowModel> AdminNotificaciones { get; set; } = [];
    public bool ThrowOnGetAdminNotificaciones { get; set; }
    public (long? ApartmentId, int? Month, int? Year, string? Service)? LastGetAdminPagosArgs { get; private set; }

    public Task<List<AdminPagoRowModel>> GetAdminPagosAsync(string token, long? apartmentId, int? month, int? year, string? service = null)
    {
        if (ThrowOnGetAdminPagos)
        {
            throw new HttpRequestException("boom");
        }

        LastGetAdminPagosArgs = (apartmentId, month, year, service);
        return Task.FromResult(AdminPagos);
    }

    public Task<List<AdminNotificationRowModel>> GetAdminNotificacionesAsync(string token) =>
        ThrowOnGetAdminNotificaciones ? throw new HttpRequestException("boom") : Task.FromResult(AdminNotificaciones);

    public List<UtilityModel> Utilities { get; set; } = [];
    public bool ThrowOnGetUtilities { get; set; }
    public AdminWriteResult SetAdminPagoPaymentResult { get; set; } = new(true, null);
    public AdminWriteResult SetAdminPagoDeadlineResult { get; set; } = new(true, null);
    public bool ThrowOnSetAdminPagoPayment { get; set; }
    public bool ThrowOnSetAdminPagoDeadline { get; set; }
    public (long ApartmentId, string Service, int Month, int Year, string? Amount, bool Paid)? LastSetAdminPagoPayment { get; private set; }
    public (string Service, int Month, int Year, DateTime DueDate)? LastSetAdminPagoDeadline { get; private set; }

    public Task<List<UtilityModel>> GetUtilitiesAsync(string token) =>
        ThrowOnGetUtilities ? throw new HttpRequestException("boom") : Task.FromResult(Utilities);

    public Task<AdminWriteResult> SetAdminPagoPaymentAsync(string token, long apartmentId, string service, int month, int year, string? amount, bool paid)
    {
        if (ThrowOnSetAdminPagoPayment)
        {
            throw new HttpRequestException("boom");
        }

        LastSetAdminPagoPayment = (apartmentId, service, month, year, amount, paid);
        return Task.FromResult(SetAdminPagoPaymentResult);
    }

    public Task<AdminWriteResult> SetAdminPagoDeadlineAsync(string token, string service, int month, int year, DateTime dueDate)
    {
        if (ThrowOnSetAdminPagoDeadline)
        {
            throw new HttpRequestException("boom");
        }

        LastSetAdminPagoDeadline = (service, month, year, dueDate);
        return Task.FromResult(SetAdminPagoDeadlineResult);
    }

    // 012-cartera-vencida-timeline
    public CarteraModel CarteraResult { get; set; } = new();
    public bool ThrowOnGetCartera { get; set; }
    public System.Net.HttpStatusCode? CarteraThrowStatusCode { get; set; }
    public int GetCarteraCallCount { get; private set; }

    public Task<CarteraModel> GetCarteraAsync(string token)
    {
        GetCarteraCallCount++;
        if (ThrowOnGetCartera)
        {
            throw new HttpRequestException("boom", null, CarteraThrowStatusCode);
        }

        return Task.FromResult(CarteraResult);
    }

    public CarteraNotifyResultModel NotificarResult { get; set; } = new();
    public bool ThrowOnNotificar { get; set; }
    public System.Net.HttpStatusCode? NotificarThrowStatusCode { get; set; }
    public int NotificarCallCount { get; private set; }
    public long? LastNotificarApartmentId { get; private set; }
    public int? LastNotificarMonth { get; private set; }
    public int? LastNotificarYear { get; private set; }

    // Lets a test hold the send "in flight" to prove a second press is ignored.
    public TaskCompletionSource<bool>? NotificarGate { get; set; }

    public async Task<CarteraNotifyResultModel> NotificarCarteraAsync(string token, long? apartmentId, int? month = null, int? year = null)
    {
        NotificarCallCount++;
        LastNotificarApartmentId = apartmentId;
        LastNotificarMonth = month;
        LastNotificarYear = year;
        if (NotificarGate is not null)
        {
            await NotificarGate.Task;
        }

        if (ThrowOnNotificar)
        {
            throw new HttpRequestException("boom", null, NotificarThrowStatusCode);
        }

        return NotificarResult;
    }
}
