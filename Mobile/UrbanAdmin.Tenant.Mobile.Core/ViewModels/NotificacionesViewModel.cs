using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public class NotificacionesViewModel(ITenantApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public List<NotificacionModel> Items { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }

    // US2 Acceptance Scenario 2: an apartment with nothing yet shows a clear
    // empty state, driven by this rather than an error or a blank screen.
    public bool IsEmpty => !IsBusy && !HasError && Items.Count == 0;

    public async Task LoadAsync()
    {
        IsBusy = true;
        HasError = false;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "Sesión no válida. Inicia sesión de nuevo.";
                HasError = true;
                return;
            }

            Items = await apiClient.GetNotificacionesAsync(token);
        }
        catch (Exception ex)
        {
            // US2/FR-005: a non-crashing API failure is still recorded as a
            // diagnostic event, even though HasError already handles the UI side.
            var statusCode = ex.ToApiStatusCode();
            diagnostics.LogApiError("notificaciones", statusCode);
            // A 403 means ActiveAccountAuthorizationHandler revoked this account (the
            // apartment's Status was set to "No arrendado") - mirrors PagosViewModel's identical
            // fix so the tenant sees the real reason on whichever screen they open first.
            ErrorMessage = statusCode == 403
                ? "Tu cuenta fue desactivada. Contacta a tu administrador."
                : "No se pudieron cargar las notificaciones. Verifica tu conexión e intenta de nuevo.";
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
