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
        catch
        {
            diagnostics.LogApiError("admin-pagos", null);
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
