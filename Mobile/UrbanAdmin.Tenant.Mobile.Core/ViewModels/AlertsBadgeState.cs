using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 013-tenant-pagos-alertas-redesign: the number shown on the tenant's Alertas tab - the payment alerts
// that need action (FR-009). One shared instance (registered as a singleton); the shell subscribes to
// Changed to redraw the tab badge. Changed is raised only when the count really changes.
public class AlertsBadgeState
{
    public int Count { get; private set; }

    public bool HasBadge => Count > 0;

    public event Action? Changed;

    public void Set(int count)
    {
        var next = Math.Max(0, count);
        if (next == Count)
        {
            return;
        }

        Count = next;
        Changed?.Invoke();
    }

    // Used on logout so the next tenant never sees the previous one's count.
    public void Reset() => Set(0);
}

// Keeps the badge fresh from screens other than Alertas (app start, Pagos appearing): one cheap read of
// GET /tenant/alertas. It never throws and never clears the badge on a failure.
public class AlertsBadgeService(ITenantApiClient apiClient, ITokenStore tokenStore, AlertsBadgeState state)
{
    public async Task RefreshAsync()
    {
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                return;
            }

            var alertas = await apiClient.GetAlertasAsync(token);
            state.Set(alertas.NeedsActionCount);
        }
        catch (Exception)
        {
            // The badge is a convenience; the previous value stays.
        }
    }
}
