using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// One rounded card of the tenant Alertas: pure text and a kind key (due-soon | due-today | overdue |
// confirmation | announcement) - the page maps the key to the theme's dot/chip colors, no colors here.
public record AlertCardRow(string Kind, string Title, string Text, string Chip, string When);

// 013-tenant-pagos-alertas-redesign: the tenant Alertas screen. Read-only. Turns GET /tenant/alertas
// into cards, keeps the Alertas tab badge in sync (AlertsBadgeState) and keeps the app's Spanish
// load-state messages. "Now" is injectable so the relative dates ("hoy", "ayer") are testable.
public class AlertasViewModel(
    ITenantApiClient apiClient,
    ITokenStore tokenStore,
    ICrashDiagnosticsService diagnostics,
    AlertsBadgeState badge,
    Func<DateTime>? nowUtc = null)
{
    private readonly Func<DateTime> _nowUtc = nowUtc ?? (() => DateTime.UtcNow);

    public List<AlertCardRow> Cards { get; private set; } = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }

    public bool IsEmpty => !IsBusy && !HasError && Cards.Count == 0;

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

            var alertas = await apiClient.GetAlertasAsync(token);
            var todayLocal = TenantChargeFormatting.LocalDate(_nowUtc());
            Cards = alertas.Items.Select(item => ToCard(item, todayLocal)).OfType<AlertCardRow>().ToList();
            badge.Set(alertas.NeedsActionCount);
        }
        catch (Exception ex)
        {
            var statusCode = ex.ToApiStatusCode();
            diagnostics.LogApiError("alertas", statusCode);
            // A 403 means the account was deactivated (ActiveAccountAuthorizationHandler): say so
            // instead of a generic message indistinguishable from a network failure.
            ErrorMessage = statusCode == 403
                ? "Tu cuenta fue desactivada. Contacta a tu administrador."
                : "No se pudieron cargar tus avisos. Verifica tu conexión e intenta de nuevo.";
            HasError = true;
        }
        finally
        {
            IsBusy = false;
        }
    }

    private static AlertCardRow? ToCard(AlertaModel item, DateTime todayLocal)
    {
        var when = TenantChargeFormatting.RelativeDate(item.At, todayLocal);
        switch (item.Kind)
        {
            case "payment":
                var status = item.Status ?? string.Empty;
                return new AlertCardRow(
                    status,
                    TenantChargeFormatting.AlertTitle(item.Utility ?? string.Empty, item.Month ?? 1),
                    TenantChargeFormatting.PaymentAlertText(status, item.DueDate ?? default, item.AmountValue),
                    TenantChargeFormatting.StatusLabel(status),
                    when);
            case "confirmation":
                return new AlertCardRow(
                    "confirmation",
                    TenantChargeFormatting.AlertTitle(item.Utility ?? string.Empty, item.Month ?? 1),
                    TenantChargeFormatting.ConfirmationText(item.AmountValue),
                    TenantChargeFormatting.ConfirmationChip,
                    when);
            case "announcement":
                return new AlertCardRow(
                    "announcement",
                    item.Title ?? string.Empty,
                    item.Body ?? string.Empty,
                    TenantChargeFormatting.AnnouncementChip,
                    when);
            default:
                return null;
        }
    }
}
