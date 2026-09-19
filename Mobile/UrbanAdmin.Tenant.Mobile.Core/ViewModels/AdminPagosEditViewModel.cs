using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// Admin Payments edit screen (spec.md FR-005a/b, Phase 6b): pick a Servicio/Mes/Año, see every
// apartment listed once for that combination (including placeholders), toggle paid / edit the
// amount per apartment, and set the shared deadline (rejected for Arriendo) - all saving
// immediately, matching Angular's admin Payments screen.
public class AdminPagosEditViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public string Service { get; set; } = string.Empty;
    public int Month { get; set; } = DateTime.Now.Month;
    public int Year { get; set; } = DateTime.Now.Year;
    public List<UtilityModel> Utilities { get; private set; } = [];
    public List<AdminPagoRowModel> Items { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }

    public bool IsEmpty => !IsBusy && !HasError && Items.Count == 0;
    public bool IsArriendo => Service == "Arriendo";

    public async Task LoadUtilitiesAsync()
    {
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                return;
            }

            Utilities = await apiClient.GetUtilitiesAsync(token);
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("admin-pagos-edit", ex.ToApiStatusCode());
        }
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

            Items = string.IsNullOrEmpty(Service)
                ? []
                : await apiClient.GetAdminPagosAsync(token, apartmentId: null, month: Month, year: Year, service: Service);
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("admin-pagos-edit", ex.ToApiStatusCode());
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task<bool> SetPaymentAsync(long apartmentId, string? amount, bool paid)
    {
        ErrorMessage = null;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "No se pudo guardar: sesión no válida.";
                return false;
            }

            var result = await apiClient.SetAdminPagoPaymentAsync(token, apartmentId, Service, Month, Year, amount, paid);
            if (!result.Success)
            {
                ErrorMessage = result.Error ?? "No se pudo guardar el pago.";
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("admin-pagos-edit", ex.ToApiStatusCode());
            ErrorMessage = "No se pudo guardar. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
    }

    public async Task<bool> SetDeadlineAsync(DateTime dueDate)
    {
        ErrorMessage = null;

        // Mirrors the Backend's own rejection (SetAdminPagoDeadlineHandler) for immediate
        // client-side feedback - Arriendo's due date is per-apartment, not a shared deadline.
        if (IsArriendo)
        {
            ErrorMessage = "Arriendo no tiene una fecha límite compartida.";
            return false;
        }

        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "No se pudo guardar: sesión no válida.";
                return false;
            }

            var result = await apiClient.SetAdminPagoDeadlineAsync(token, Service, Month, Year, dueDate);
            if (!result.Success)
            {
                ErrorMessage = result.Error ?? "No se pudo guardar la fecha límite.";
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("admin-pagos-edit", ex.ToApiStatusCode());
            ErrorMessage = "No se pudo guardar. Verifica tu conexión e intenta de nuevo.";
            return false;
        }
    }
}
