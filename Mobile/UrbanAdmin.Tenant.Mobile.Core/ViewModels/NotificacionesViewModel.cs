using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public class NotificacionesViewModel(ITenantApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public List<NotificacionModel> Items { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }

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
                HasError = true;
                return;
            }

            Items = await apiClient.GetNotificacionesAsync(token);
        }
        catch
        {
            // US2/FR-005: a non-crashing API failure is still recorded as a
            // diagnostic event, even though HasError already handles the UI side.
            diagnostics.LogApiError("notificaciones", null);
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
