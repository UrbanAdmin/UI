using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 029-tenant-mobile-lecturas: the tenant's own Gas/Agua readings statement. Read-only by design
// (FR-008-equivalent): no Save/Submit method, never calls a write endpoint.
public class LecturasViewModel
{
    private readonly ITenantApiClient _apiClient;
    private readonly ITokenStore _tokenStore;
    private readonly ICrashDiagnosticsService _diagnostics;
    private readonly Func<DateTime> _today;
    private bool _perfilLoaded;

    public LecturasViewModel(ITenantApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics, Func<DateTime>? today = null)
    {
        _apiClient = apiClient;
        _tokenStore = tokenStore;
        _diagnostics = diagnostics;
        _today = today ?? (() => DateTime.Now);
        var now = _today();
        Month = now.Month;
        Year = now.Year;
    }

    // Agua is first, matching counter-utilities.component.ts's/payments.component.ts's own
    // services: ServiceName[] = ['Agua', 'Luz', 'Gas', ...] ordering.
    public string SelectedService { get; set; } = "Agua";
    public int Month { get; set; }
    public int Year { get; set; }
    public List<LecturasPeriodoModel> Periods { get; private set; } = [];
    public long? SelectedPeriodId { get; set; }
    public LecturasModel? Statement { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }
    public string HeaderKicker { get; private set; } = string.Empty;

    public bool IsEmpty => !HasError && (Statement is null || Statement.State == "empty");

    public string PeriodLabel
    {
        get
        {
            if (SelectedService != "Agua")
            {
                return CarteraFormatting.MonthLabel(Month, Year);
            }
            var period = Periods.FirstOrDefault(p => p.Id == SelectedPeriodId);
            return period is null ? string.Empty : LecturasFormatting.FormatPeriodRange(period.StartDate, period.EndDate);
        }
    }

    public async Task LoadAsync()
    {
        HasError = false;
        try
        {
            var token = await _tokenStore.GetTokenAsync();
            if (token is null)
            {
                ErrorMessage = "Sesión no válida. Inicia sesión de nuevo.";
                HasError = true;
                return;
            }

            await LoadHeaderAsync(token);

            if (SelectedService == "Agua")
            {
                await LoadAguaAsync(token);
            }
            else
            {
                // Gas and Luz both use a plain Mes/Año pair, no period list.
                Statement = await _apiClient.GetLecturasAsync(token, SelectedService, Month, Year, null);
            }
        }
        catch (Exception ex)
        {
            var statusCode = ex.ToApiStatusCode();
            _diagnostics.LogApiError("lecturas", statusCode);
            ErrorMessage = statusCode == 403
                ? "Tu cuenta fue desactivada. Contacta a tu administrador."
                : "No se pudo cargar tu información de lecturas. Verifica tu conexión e intenta de nuevo.";
            HasError = true;
        }
    }

    // The header ("APTO 304 · MARÍA FERNÁNDEZ") is loaded once, same as PagosViewModel - if it
    // cannot be read the screen still works and the kicker is simply empty.
    private async Task LoadHeaderAsync(string token)
    {
        if (_perfilLoaded)
        {
            return;
        }

        try
        {
            var perfil = await _apiClient.GetPerfilAsync(token);
            HeaderKicker = TenantChargeFormatting.HeaderKicker(perfil.ApartmentNumber, perfil.OwnerName);
            _perfilLoaded = true;
        }
        catch (Exception)
        {
            HeaderKicker = string.Empty;
        }
    }

    private async Task LoadAguaAsync(string token)
    {
        // The raw endpoint (GET /WaterBills) returns oldest-first; newest-first display is this
        // ViewModel's responsibility, mirroring payments.component.ts's own client-side sort.
        Periods = (await _apiClient.GetLecturasPeriodosAsync(token)).OrderByDescending(p => p.StartDate).ToList();

        // Preserve an already-selected period across a refresh; otherwise auto-select the one
        // matching the current date, else the newest - mirrors payments.component.ts's
        // applyAguaPeriod() from 028's own Periodo picker.
        if (SelectedPeriodId is null || !Periods.Any(p => p.Id == SelectedPeriodId))
        {
            var now = _today();
            var matching = Periods.FirstOrDefault(p => p.StartDate <= now && now <= p.EndDate);
            SelectedPeriodId = (matching ?? Periods.OrderByDescending(p => p.StartDate).FirstOrDefault())?.Id;
        }

        if (SelectedPeriodId is null)
        {
            Statement = new LecturasModel { State = "empty" };
            return;
        }

        Statement = await _apiClient.GetLecturasAsync(token, "Agua", null, null, SelectedPeriodId);
    }
}
