using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 013-tenant-pagos-alertas-redesign slice C: the administrator's announcements list (newest first,
// as the server sends it), with the app's loading / empty / error-with-retry states (FR-015).
public class ComunicadosViewModel(IAdminApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public List<ComunicadoModel> Items { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }

    public bool IsEmpty => !IsBusy && !HasError && Items.Count == 0;

    public async Task LoadAsync()
    {
        IsBusy = true;
        HasError = false;
        ErrorMessage = null;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "Sesión no válida. Inicia sesión de nuevo.";
                HasError = true;
                return;
            }

            Items = await apiClient.GetComunicadosAsync(token);
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("comunicados", ex.ToApiStatusCode());
            ErrorMessage = "No se pudieron cargar los comunicados. Verifica tu conexión e intenta de nuevo.";
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }
}
