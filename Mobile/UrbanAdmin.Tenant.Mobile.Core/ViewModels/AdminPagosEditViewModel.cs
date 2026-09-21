using UrbanAdmin.Tenant.Mobile.Core.Formatting;
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

    // 014-admin-pagos-first-tab US4 (approved mockup Mockups/admin-pagos-edit): rows with a visible save state,
    // the paid summary and the deadline card state.
    private DateTime? _savedDeadline;
    private DateTime? _pendingDeadline;

    public List<AdminPagoEditRow> Rows { get; private set; } = [];

    public IReadOnlyList<string> ServiceNames => Utilities.Select(u => u.Name).ToList();

    public string PaidSummary
    {
        get
        {
            var paid = Rows.Count(r => r.Paid);
            return $"{paid} {(paid == 1 ? "pagado" : "pagados")} de {Rows.Count}";
        }
    }

    public bool ShowDeadlineCard => !IsArriendo;
    public string ArriendoHint => "El vencimiento de Arriendo se calcula por apartamento, desde la fecha de inicio del contrato. No se fija aquí.";
    public string DeadlineTitle => $"Fecha límite de {Service.ToLowerInvariant()}";
    public string DeadlineNote { get; private set; } = string.Empty;

    public DateTime? SavedDeadline => _savedDeadline;

    public DateTime? PendingDeadline => _pendingDeadline;

    public string DeadlineDisplay => _savedDeadline is DateTime d
        ? $"{d.Day} de {CarteraFormatting.MonthName(d.Month).ToLowerInvariant()}"
        : "Sin fecha";

    public bool DeadlineDirty => _pendingDeadline is DateTime p && p.Date != _savedDeadline?.Date;

    public void SetPendingDeadline(DateTime date)
    {
        _pendingDeadline = date.Date;
        DeadlineNote = string.Empty;
    }

    public async Task<bool> SaveDeadlineAsync()
    {
        if (!DeadlineDirty || _pendingDeadline is not DateTime pending)
        {
            return false;
        }

        // 016: the date belongs to the service and month it was set for, even if the screen moves on while it saves.
        var service = Service;
        var month = Month;
        var year = Year;
        if (!await SetDeadlineAsync(service, month, year, pending))
        {
            return false;
        }

        if (service == Service && month == Month && year == Year)
        {
            _savedDeadline = pending;
            _pendingDeadline = null;
            DeadlineNote = "Fecha guardada ✓";
        }

        return true;
    }

    // Saves one row and reports the outcome on the row itself ("Guardando…" then "Guardado ✓" or the failure).
    public async Task<bool> SaveRowAsync(AdminPagoEditRow row)
    {
        row.MarkSaving();
        var ok = await SetPaymentAsync(row.ApartmentId, row.Service, row.Month, row.Year, row.Amount, row.Paid);
        if (ok)
        {
            row.MarkSaved();
        }
        else
        {
            row.MarkFailed();
        }

        return ok;
    }

    // Called when the amount field loses focus; saves only when what was typed differs from what is stored.
    public async Task<bool> CommitAmountAsync(AdminPagoEditRow row, string? typed)
    {
        var parsed = AmountInput.Parse(typed);
        if (parsed == row.Amount)
        {
            row.EndEdit();
            return true;
        }

        row.Amount = parsed;
        row.EndEdit();
        return await SaveRowAsync(row);
    }

    public async Task<bool> TogglePaidAsync(AdminPagoEditRow row)
    {
        row.Paid = !row.Paid;
        return await SaveRowAsync(row);
    }

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

    private int _loadNumber;

    // 016-fix-edit-service-values: returns true when this load is the latest and was applied to the screen state, false when a
    // newer selection superseded it (its response is discarded: no rows, no error, no busy change), so overlapping loads can
    // never leave an older service or month on screen.
    public async Task<bool> LoadAsync()
    {
        var number = ++_loadNumber;
        var service = Service;
        var month = Month;
        var year = Year;
        IsBusy = true;
        HasError = false;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                HasError = true;
                return true;
            }

            var items = string.IsNullOrEmpty(service)
                ? []
                : await apiClient.GetAdminPagosAsync(token, apartmentId: null, month: month, year: year, service: service);
            if (number != _loadNumber)
            {
                return false;
            }

            Items = items;
            BuildRows(service, month, year);
            return true;
        }
        catch (Exception ex)
        {
            diagnostics.LogApiError("admin-pagos-edit", ex.ToApiStatusCode());
            if (number != _loadNumber)
            {
                return false;
            }

            HasError = true;
            return true;
        }
        finally
        {
            if (number == _loadNumber)
            {
                IsBusy = false;
            }
        }
    }

    private void BuildRows(string service, int month, int year)
    {
        Rows = Items
            .OrderBy(i => i.ApartmentNumber, StringComparer.Ordinal)
            .Select(i => new AdminPagoEditRow(i, service, month, year))
            .ToList();

        // Every apartment shares the service's deadline; no saved deadline comes back as the default date.
        var due = Items.Count > 0 ? Items[0].DueDate : default;
        _savedDeadline = due.Year > 1 ? due.Date : null;
        _pendingDeadline = null;
        DeadlineNote = string.Empty;
    }

    // Saves for the screen's current selection (kept for callers that have no row).
    public Task<bool> SetPaymentAsync(long apartmentId, string? amount, bool paid) =>
        SetPaymentAsync(apartmentId, Service, Month, Year, amount, paid);

    // Saves for an explicit service and month - the row's own (016): the selection may have changed since it was loaded.
    public async Task<bool> SetPaymentAsync(long apartmentId, string service, int month, int year, string? amount, bool paid)
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

            var result = await apiClient.SetAdminPagoPaymentAsync(token, apartmentId, service, month, year, amount, paid);
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

    public Task<bool> SetDeadlineAsync(DateTime dueDate) => SetDeadlineAsync(Service, Month, Year, dueDate);

    public async Task<bool> SetDeadlineAsync(string service, int month, int year, DateTime dueDate)
    {
        ErrorMessage = null;

        // Mirrors the Backend's own rejection (SetAdminPagoDeadlineHandler) for immediate
        // client-side feedback - Arriendo's due date is per-apartment, not a shared deadline.
        if (service == "Arriendo")
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

            var result = await apiClient.SetAdminPagoDeadlineAsync(token, service, month, year, dueDate);
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
