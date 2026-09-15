using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.Services;

public interface ITenantApiClient
{
    // Returns the JWT on success, null on invalid credentials - mirrors
    // POST /auth/login's existing shape (contracts/tenant-api.md: "Auth (reused, not new)").
    Task<string?> LoginAsync(string username, string password);

    // apartmentId/userId are never sent here - the Backend derives them from
    // the bearer token (contracts/tenant-api.md's ApartmentOwnerOnly routes).
    Task RegisterDeviceAsync(string token, string platform, string pushToken);

    Task<List<NotificacionModel>> GetNotificacionesAsync(string token);

    // Read-only by design - there is deliberately no corresponding
    // Save/Update method anywhere in this interface (FR-008).
    Task<List<PagoModel>> GetPagosAsync(string token);
}
