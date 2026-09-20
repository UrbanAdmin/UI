using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Admin-facing API calls (act on any apartment/user, not "mine") - kept separate from
// ITenantApiClient, which is explicitly scoped to the calling tenant's own identity/apartment
// (specs/008-mobile-admin-views/research.md §7). Each user story adds its own methods here.
public interface IAdminApiClient
{
    Task<List<ApartmentModel>> GetApartmentsAsync(string token);

    Task<AdminWriteResult> CreateApartmentAsync(string token, string name, string owner, DateTime? contractStartDate, string status);

    Task<AdminWriteResult> UpdateApartmentAsync(string token, long apartmentId, string name, string owner, DateTime? contractStartDate, string status);

    Task DeleteApartmentAsync(string token, long apartmentId);

    Task UploadContractAsync(string token, long apartmentId, string fileName, string contentType, Stream content);

    Task<(byte[] Content, string ContentType, string FileName)?> DownloadContractAsync(string token, long apartmentId);

    Task<List<UserModel>> GetUsersAsync(string token);

    Task<AdminWriteResult> CreateUserAsync(string token, string username, string password, string role, long? apartmentId);

    Task<AdminWriteResult> UpdateUserAsync(string token, long userId, string role, long? apartmentId, string? newPassword);

    Task DeleteUserAsync(string token, long userId);

    Task<List<AdminPagoRowModel>> GetAdminPagosAsync(string token, long? apartmentId, int? month, int? year, string? service = null);

    Task<List<AdminNotificationRowModel>> GetAdminNotificacionesAsync(string token);

    Task<List<UtilityModel>> GetUtilitiesAsync(string token);

    Task<AdminWriteResult> SetAdminPagoPaymentAsync(string token, long apartmentId, string service, int month, int year, string? amount, bool paid);

    Task<AdminWriteResult> SetAdminPagoDeadlineAsync(string token, string service, int month, int year, DateTime dueDate);

    // 012-cartera-vencida-timeline: building-wide overdue balance across every period
    // (GET /admin/cartera).
    Task<CarteraModel> GetCarteraAsync(string token);

    // POST /admin/cartera/notificar - a null apartmentId notifies every apartment with overdue
    // charges, a value notifies just that apartment. month + year (both or neither) limit the
    // notice to that one billing period; the Cartera screen always sends its selected month.
    Task<CarteraNotifyResultModel> NotificarCarteraAsync(string token, long? apartmentId, int? month, int? year);
}
