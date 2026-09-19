using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// Read-only by design (FR-008): this view model exposes no Save/Submit
// method and never calls a write endpoint - Pagos only ever loads data.
public class PagosViewModel(ITenantApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    // 009-tenant-pagos-period-pesos FR-001/FR-002: defaults to today, overridable by the page's
    // Mes/Año pickers - mirrors AdminPagosViewModel's existing Month/Year pattern.
    public int Month { get; set; } = DateTime.Now.Month;
    public int Year { get; set; } = DateTime.Now.Year;
    public List<PagoModel> Items { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }

    // US3 Acceptance Scenario 3: nothing pending shows a clear "nothing due"
    // state rather than an empty-looking error.
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

            Items = await apiClient.GetPagosAsync(token, Month, Year);
        }
        catch
        {
            // US2/FR-005: a non-crashing API failure is still recorded as a
            // diagnostic event, even though HasError already handles the UI side.
            diagnostics.LogApiError("pagos", null);
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
