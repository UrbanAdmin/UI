using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// Read-only by design (FR-008): this view model exposes no Save/Submit
// method and never calls a write endpoint - Pagos only ever loads data.
//
// 013-tenant-pagos-alertas-redesign: month arrows (Navigator) instead of the Mes/Año pickers, the
// "Pendiente este mes" summary, the timeline rows and the header kicker. "Today" is injectable.
public class PagosViewModel(
    ITenantApiClient apiClient,
    ITokenStore tokenStore,
    ICrashDiagnosticsService diagnostics,
    Func<DateTime>? today = null)
{
    private bool _perfilLoaded;

    // Defaults to the current month, moved by the page's previous/next arrows (Navigator). Month and
    // Year stay settable so existing callers (and the 009 tests) keep working; they delegate to it.
    public PagosMonthNavigator Navigator { get; } = new(today);

    public int Month
    {
        get => Navigator.Month;
        set => Navigator.Set(value, Navigator.Year);
    }

    public int Year
    {
        get => Navigator.Year;
        set => Navigator.Set(Navigator.Month, value);
    }

    public string MonthLabel => Navigator.Label;

    public List<PagoModel> Items { get; private set; } = [];
    public List<PagoTimelineRow> Rows { get; private set; } = [];
    public string HeaderKicker { get; private set; } = string.Empty;
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }

    // US3 Acceptance Scenario 3: nothing pending shows a clear "nothing due"
    // state rather than an empty-looking error.
    public bool IsEmpty => !IsBusy && !HasError && Items.Count == 0;

    // The dark "PENDIENTE ESTE MES" card: the unpaid charges' amounts (a charge with no amount adds 0
    // but is still counted) and how many there are.
    public decimal PendingTotal => Items.Where(p => !p.Paid).Sum(p => p.AmountValue ?? 0m);
    public string PendingTotalDisplay => CopCurrencyFormatter.Format(PendingTotal);
    public int PendingCount => Items.Count(p => !p.Paid);
    public bool IsUpToDate => PendingCount == 0;

    public string SummaryHint => PendingCount switch
    {
        0 => "Estás al día este mes.",
        1 => "1 concepto por pagar",
        _ => $"{PendingCount} conceptos por pagar",
    };

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

            await LoadHeaderAsync(token);
            Items = await apiClient.GetPagosAsync(token, Month, Year);
            Rows = PagosTimelineRows.Build(Items);
        }
        catch (Exception ex)
        {
            // US2/FR-005: a non-crashing API failure is still recorded as a
            // diagnostic event, even though HasError already handles the UI side.
            var statusCode = ex.ToApiStatusCode();
            diagnostics.LogApiError("pagos", statusCode);
            // A 403 means ActiveAccountAuthorizationHandler revoked this account (the
            // apartment's Status was set to "No arrendado") - tell the tenant that specifically
            // instead of a generic message indistinguishable from a network failure.
            ErrorMessage = statusCode == 403
                ? "Tu cuenta fue desactivada. Contacta a tu administrador."
                : "No se pudo cargar tu información de pagos. Verifica tu conexión e intenta de nuevo.";
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }

    // The header ("APTO 502 · LAURA GÓMEZ") is loaded once; if it cannot be read the page still works
    // and the kicker is simply empty.
    private async Task LoadHeaderAsync(string token)
    {
        if (_perfilLoaded)
        {
            return;
        }

        try
        {
            var perfil = await apiClient.GetPerfilAsync(token);
            HeaderKicker = TenantChargeFormatting.HeaderKicker(perfil.ApartmentNumber, perfil.OwnerName);
            _perfilLoaded = true;
        }
        catch (Exception)
        {
            HeaderKicker = string.Empty;
        }
    }
}
