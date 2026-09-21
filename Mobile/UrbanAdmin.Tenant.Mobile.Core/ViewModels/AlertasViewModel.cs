using System.Collections.ObjectModel;
using System.ComponentModel;
using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// One rounded card of the tenant Alertas: pure text and a kind key (due-soon | due-today | overdue |
// confirmation | announcement) - the page maps the key to the theme's dot/chip colors, no colors here.
// 017: IsUnread is true until the tenant marks the alert read (swipe or "Marcar todas"); it is observable so a
// card turns flat in place; a screen reader announces an unread card as new and offers "Marcar como leída".
public class AlertCardRow(string kind, string title, string text, string chip, string when, string key, bool isUnread) : INotifyPropertyChanged
{
    private bool _isUnread = isUnread;

    public string Kind { get; } = kind;
    public string Title { get; } = title;
    public string Text { get; } = text;
    public string Chip { get; } = chip;
    public string When { get; } = when;

    // The alert's stable key (AlertsReadTracker.KeyOf): what the phone remembers as read.
    public string Key { get; } = key;

    public bool IsUnread => _isUnread;

    public string AccessibleName => (_isUnread ? "Nuevo. " : string.Empty) + $"{Chip}. {Title}. {Text}";

    public event PropertyChangedEventHandler? PropertyChanged;

    internal void MarkRead()
    {
        if (!_isUnread)
        {
            return;
        }

        _isUnread = false;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsUnread)));
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(AccessibleName)));
    }
}

// 013-tenant-pagos-alertas-redesign: the tenant Alertas screen. Read-only. Turns GET /tenant/alertas
// into cards, keeps the Alertas tab badge in sync (AlertsBadgeState) and keeps the app's Spanish
// load-state messages. "Now" is injectable so the relative dates ("hoy", "ayer") are testable.
public class AlertasViewModel(
    ITenantApiClient apiClient,
    ITokenStore tokenStore,
    ICrashDiagnosticsService diagnostics,
    AlertsBadgeState badge,
    AlertsReadTracker readTracker,
    Func<DateTime>? nowUtc = null)
{
    private readonly Func<DateTime> _nowUtc = nowUtc ?? (() => DateTime.UtcNow);

    // 017: Alertas lists only the alerts not read yet; AllCards (the "Ver todas las notificaciones" screen) has every alert.
    public ObservableCollection<AlertCardRow> Cards { get; } = [];
    public List<AlertCardRow> AllCards { get; private set; } = [];

    private List<AlertaModel> _items = [];
    public bool IsBusy { get; private set; }
    public bool HasError { get; private set; }
    public string? ErrorMessage { get; private set; }

    public bool IsEmpty => !IsBusy && !HasError && Cards.Count == 0;

    // Drives the "Marcar todas" header action.
    public bool HasUnread => Cards.Count > 0;

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
            // 017: loading never marks anything read (only the tenant does, by swipe or "Marcar todas"); the badge is the
            // unread count (the server's needsActionCount is no longer used).
            var unread = (await readTracker.UnreadKeysAsync(alertas.Items)).ToHashSet();
            _items = [.. alertas.Items];
            AllCards = alertas.Items
                .Select(item => ToCard(item, todayLocal, unread.Contains(AlertsReadTracker.KeyOf(item) ?? string.Empty)))
                .OfType<AlertCardRow>()
                .ToList();
            Cards.Clear();
            foreach (var card in AllCards.Where(c => c.IsUnread))
            {
                Cards.Add(card);
            }

            badge.Set(Cards.Count);
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

    // A swipe on an unread card: it is remembered as read, leaves the list and the badge goes down.
    public async Task MarkReadAsync(AlertCardRow card)
    {
        if (!card.IsUnread)
        {
            return;
        }

        var item = _items.FirstOrDefault(i => AlertsReadTracker.KeyOf(i) == card.Key);
        if (item is not null)
        {
            await readTracker.MarkReadAsync(item, _items);
        }

        card.MarkRead();
        Cards.Remove(card);
        badge.Set(Cards.Count);
    }

    // "Marcar todas": everything is remembered as read, the list empties and the badge goes to 0.
    public async Task MarkAllReadAsync()
    {
        await readTracker.MarkAllReadAsync(_items);
        foreach (var card in AllCards)
        {
            card.MarkRead();
        }

        Cards.Clear();
        badge.Set(0);
    }

    private static AlertCardRow? ToCard(AlertaModel item, DateTime todayLocal, bool isUnread)
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
                    when,
                    AlertsReadTracker.KeyOf(item) ?? string.Empty,
                    isUnread);
            case "confirmation":
                return new AlertCardRow(
                    "confirmation",
                    TenantChargeFormatting.AlertTitle(item.Utility ?? string.Empty, item.Month ?? 1),
                    TenantChargeFormatting.ConfirmationText(item.AmountValue),
                    TenantChargeFormatting.ConfirmationChip,
                    when,
                    AlertsReadTracker.KeyOf(item) ?? string.Empty,
                    isUnread);
            case "announcement":
                return new AlertCardRow(
                    "announcement",
                    item.Title ?? string.Empty,
                    item.Body ?? string.Empty,
                    TenantChargeFormatting.AnnouncementChip,
                    when,
                    AlertsReadTracker.KeyOf(item) ?? string.Empty,
                    isUnread);
            default:
                return null;
        }
    }
}
