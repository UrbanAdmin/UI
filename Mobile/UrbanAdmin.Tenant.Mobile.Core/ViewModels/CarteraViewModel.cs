using System.Globalization;
using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// What a notify press produced: a message for the administrator and whether it should read as a
// success (someone was actually notified) or not.
public record CarteraNotifyOutcome(bool Success, string Message);

// 012-cartera-vencida-timeline: the Administrator's Cartera screen - the building-wide overdue
// balance by year and month, plus the bulk and per-apartment notify actions. Same load-state
// shape as the other admin view models (AdminPagosViewModel); the API call is one server-side
// aggregate, never a client-side loop. toLocalTime is injectable so the "ya se notificó hoy a las
// HH:mm" text is deterministic in tests (the server sends UTC).
public class CarteraViewModel(
    IAdminApiClient apiClient,
    ITokenStore tokenStore,
    ICrashDiagnosticsService diagnostics,
    Func<DateTime, DateTime>? toLocalTime = null,
    Func<DateTime>? today = null)
{
    private const string NoSession = "Sesión no válida. Inicia sesión de nuevo.";
    private const string Deactivated = "Tu cuenta fue desactivada. Contacta a tu administrador.";

    private readonly Func<DateTime, DateTime> _toLocal = toLocalTime ?? (utc => utc.ToLocalTime());
    private static readonly Func<DateTime> SystemNow = () => DateTime.Now;
    private readonly Func<DateTime> _today = today ?? SystemNow;
    private bool _hasLoaded;

    // The screen works on one month at a time (FR-020); it opens on the current one.
    public int SelectedMonth { get; private set; } = (today ?? SystemNow)().Month;
    public int SelectedYear { get; private set; } = (today ?? SystemNow)().Year;

    public void SelectPeriod(int month, int year)
    {
        SelectedMonth = month;
        SelectedYear = year;
    }

    // Año selector: the usual window plus every year that has overdue data.
    public List<int> AvailableYears =>
        AdminPagosPeriodWindow.YearsWithData(_today().Year, Cartera.Years.Select(y => y.Year));

    // The selected month's entry from the timeline, or an empty one when nothing is overdue then
    // (the hero and the timeline still show it, at $0).
    public CarteraMonthModel SelectedMonthEntry =>
        Cartera.Years.SelectMany(y => y.Months).FirstOrDefault(m => m.Month == SelectedMonth && m.Year == SelectedYear)
        ?? new CarteraMonthModel { Month = SelectedMonth, Year = SelectedYear };

    // The timeline is a flat list of months, newest first (no year headings): every month that has
    // overdue or "por vencer" charges plus the selected month/year even when it has none (an empty
    // entry, figures 0). Built fresh; Cartera is never mutated.
    public List<CarteraMonthModel> TimelineMonths
    {
        get
        {
            var months = Cartera.Years.SelectMany(y => y.Months).ToList();
            if (!months.Any(m => m.Month == SelectedMonth && m.Year == SelectedYear))
            {
                months.Add(SelectedMonthEntry);
            }

            return months.OrderByDescending(m => m.Year).ThenByDescending(m => m.Month).ToList();
        }
    }

    // "Empty" is about OVERDUE charges (the hero's Cartera vencida); the month may still list
    // "por vencer" ones.
    public bool SelectedMonthIsEmpty => SelectedMonthEntry.Charges.Count == 0;

    public bool SelectedMonthHasUpcoming => SelectedMonthEntry.UpcomingCharges.Count > 0;

    private string SelectedMonthLabel =>
        $"{CarteraFormatting.MonthName(SelectedMonth).ToLowerInvariant()} {SelectedYear}";

    // Apartments with overdue charges in the selected month, joined with their reachability and
    // "already notified today" state (both are per apartment, decided server-side).
    private List<CarteraApartmentModel> SelectedMonthApartments()
    {
        var ids = SelectedMonthEntry.Charges.Select(c => c.ApartmentId).Distinct().ToHashSet();
        return Cartera.Apartments.Where(a => ids.Contains(a.ApartmentId)).ToList();
    }

    public CarteraModel Cartera { get; private set; } = new();
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }
    public bool IsSending { get; private set; }

    // Nothing overdue at all. Not simply Total == 0: charges that have no recorded amount add 0
    // pesos yet are still listed ("sin monto"), so emptiness is about the charges, not the sum.
    public bool IsEmpty => _hasLoaded && !IsBusy && !HasError && Cartera.Years.Count == 0;

    // The bulk button is enabled only when someone overdue in the selected month can be reached.
    public bool CanNotifyAll => SelectedMonthApartments().Any(a => a.CanNotify);

    // The existing admin Pagos screen is now a pushed route (US2). A month entry opens it on that
    // month/year; the general access opens it on the current month, as it did as a tab.
    public string BuildPagosRoute(int? month, int? year) =>
        month is int m && year is int y ? $"AdminPagos?month={m}&year={y}" : "AdminPagos";

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
                ErrorMessage = NoSession;
                HasError = true;
                return;
            }

            Cartera = await apiClient.GetCarteraAsync(token);
            _hasLoaded = true;
        }
        catch (Exception ex)
        {
            var statusCode = ex.ToApiStatusCode();
            diagnostics.LogApiError("admin-cartera", statusCode);
            // A 403 means the account was deactivated (ActiveAccountAuthorizationHandler) - say so
            // instead of a generic message indistinguishable from a network failure.
            ErrorMessage = statusCode == 403
                ? Deactivated
                : "No se pudo cargar la cartera. Verifica tu conexión e intenta de nuevo.";
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }

    // FR-010/FR-019: who will be notified, who cannot be, and who already got a notice today.
    public string BuildBulkConfirmation()
    {
        var inMonth = SelectedMonthApartments();
        var notifiable = inMonth.Where(a => a.CanNotify).ToList();
        var unreachable = inMonth.Count - notifiable.Count;
        var alreadyToday = notifiable.Count(a => a.NotifiedToday);

        var lines = new List<string> { $"Se notificará a {CarteraFormatting.Apartments(notifiable.Count)} con cartera vencida de {SelectedMonthLabel}." };
        if (unreachable > 0)
        {
            lines.Add(unreachable == 1
                ? "1 apartamento no se puede notificar (sin arrendar o sin propietario activo)."
                : $"{unreachable} apartamentos no se pueden notificar (sin arrendar o sin propietario activo).");
        }

        if (alreadyToday > 0)
        {
            lines.Add(alreadyToday == 1
                ? "1 ya recibió una notificación hoy. Puedes enviarla de nuevo."
                : $"{alreadyToday} ya recibieron una notificación hoy. Puedes enviarla de nuevo.");
        }

        return string.Join("\n", lines);
    }

    public string BuildApartmentConfirmation(long apartmentId)
    {
        var apartment = Cartera.Apartments.FirstOrDefault(a => a.ApartmentId == apartmentId);
        if (apartment is null)
        {
            return string.Empty;
        }

        var who = string.IsNullOrWhiteSpace(apartment.Owner) ? "el propietario" : apartment.Owner;
        var charges = SelectedMonthEntry.Charges.Where(c => c.ApartmentId == apartmentId).ToList();
        var total = charges.Sum(c => c.Amount ?? 0m);
        var text = $"Se enviará a {who} el detalle de su cartera vencida de {SelectedMonthLabel}: " +
                   $"{CarteraFormatting.Concepts(charges.Count)} por {CopCurrencyFormatter.Format(total)}.";
        if (apartment.NotifiedToday && apartment.LastNotifiedAt is DateTime last)
        {
            text += $"\nYa se notificó hoy a las {_toLocal(last).ToString("HH:mm", CultureInfo.InvariantCulture)}. Puedes enviarla de nuevo.";
        }

        return text;
    }

    public Task<CarteraNotifyOutcome> NotifyAllAsync() => NotifyAsync(null);

    public Task<CarteraNotifyOutcome> NotifyApartmentAsync(long apartmentId) => NotifyAsync(apartmentId);

    private async Task<CarteraNotifyOutcome> NotifyAsync(long? apartmentId)
    {
        // FR-013: a second press while a send is in flight must not send again.
        if (IsSending)
        {
            return new CarteraNotifyOutcome(false, "Ya hay un envío en curso.");
        }

        IsSending = true;
        try
        {
            var token = await tokenStore.GetTokenAsync();
            if (token is null)
            {
                return new CarteraNotifyOutcome(false, NoSession);
            }

            var target = apartmentId is long id ? Cartera.Apartments.FirstOrDefault(a => a.ApartmentId == id) : null;
            var result = await apiClient.NotificarCarteraAsync(token, apartmentId, SelectedMonth, SelectedYear);
            var outcome = Describe(result, apartmentId is not null, target);

            // Refresh so "notificado hoy" (and any changed balance) is current for the next press.
            await LoadAsync();
            return outcome;
        }
        catch (Exception ex)
        {
            var statusCode = ex.ToApiStatusCode();
            diagnostics.LogApiError("admin-cartera-notificar", statusCode);
            return new CarteraNotifyOutcome(
                false,
                statusCode == 403
                    ? Deactivated
                    : "No se pudo enviar la notificación. Verifica tu conexión e intenta de nuevo.");
        }
        finally
        {
            IsSending = false;
        }
    }

    private static CarteraNotifyOutcome Describe(CarteraNotifyResultModel result, bool single, CarteraApartmentModel? target)
    {
        if (single)
        {
            var number = target?.ApartmentNumber ?? string.Empty;
            return result.NotifiedApartments >= 1
                ? new CarteraNotifyOutcome(true, $"Notificación enviada al apto {number}")
                : new CarteraNotifyOutcome(false, $"El apto {number} no se puede notificar: {target?.CannotNotifyReason ?? "sin propietario activo"}.");
        }

        if (result.NotifiedApartments == 0)
        {
            return new CarteraNotifyOutcome(false, "Ningún apartamento se pudo notificar (sin arrendar o sin propietario activo).");
        }

        var message = $"Notificación enviada a {CarteraFormatting.Apartments(result.NotifiedApartments)}";
        if (result.UnreachableApartments > 0)
        {
            message += result.UnreachableApartments == 1
                ? " · 1 no se pudo notificar"
                : $" · {result.UnreachableApartments} no se pudieron notificar";
        }

        return new CarteraNotifyOutcome(true, message);
    }
}
