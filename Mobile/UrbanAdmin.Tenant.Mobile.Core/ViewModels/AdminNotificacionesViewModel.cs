using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// Read-only, all-apartments Notifications view (spec.md US4) - the live outstanding-dues scan
// from research.md §1, matching Angular's admin Notifications screen (not the tenant
// Notificaciones screen's reminder-log semantics).
public class AdminNotificacionesViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public List<AdminNotificationRowModel> Items { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }

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

            Items = await apiClient.GetAdminNotificacionesAsync(token);
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("admin-notificaciones", ex.ToApiStatusCode());
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
