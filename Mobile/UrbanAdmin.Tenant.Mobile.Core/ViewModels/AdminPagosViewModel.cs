using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// Read-only, all-apartments Payments view (spec.md US4) - calls GetAdminPagosAsync for every
// apartment, defaulting to the current month/year but selectable (mirrors Angular's Mes/Año
// selectors on the admin Payments screen).
public class AdminPagosViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public List<AdminPagoRowModel> Items { get; private set; } = [];
    public int Month { get; set; } = DateTime.Now.Month;
    public int Year { get; set; } = DateTime.Now.Year;
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }

    public bool IsEmpty => !IsBusy && !HasError && Items.Count == 0;

    // 014-admin-pagos-first-tab FR-010: the Pagos tab opens on the current month, not on a stale period.
    public void ResetToCurrentPeriod(DateTime now)
    {
        Month = now.Month;
        Year = now.Year;
    }

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

            Items = await apiClient.GetAdminPagosAsync(token, apartmentId: null, month: Month, year: Year);
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("admin-pagos", ex.ToApiStatusCode());
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }

    // Shared by the summary page's per-apartment subtotal (FR-005c, excludes Arriendo). An
    // unparseable or placeholder (null) Amount contributes 0 rather than throwing - a
    // placeholder row has nothing to add yet.
    public static decimal SumNonArriendoAmounts(IEnumerable<AdminPagoRowModel> rows) =>
        rows.Where(r => r.Utility != "Arriendo")
            .Sum(r => decimal.TryParse(r.Amount, out var amount) ? amount : 0m);
}
