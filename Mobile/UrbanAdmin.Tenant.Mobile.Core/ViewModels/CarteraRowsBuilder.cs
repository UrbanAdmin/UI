using System.Globalization;
using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// How old the oldest overdue charge of a month is; the page maps it to a theme colour (no colours in Core).
public enum MonthSeverity
{
    Recent,
    Aging,
    Severe,
}

public record CarteraChargeRow(string Service, string AmountDisplay, bool AmountMissing, string DaysLabel);

public class CarteraApartmentRow
{
    public long ApartmentId { get; init; }
    public string Number { get; init; } = string.Empty;
    public string OwnerDisplay { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public bool CanNotify { get; init; }
    public bool AlreadyNotifiedToday { get; init; }
    public string CaptionText { get; init; } = string.Empty;
    public List<CarteraChargeRow> Services { get; init; } = [];
    public List<CarteraChargeRow> Rent { get; init; } = [];
    public List<CarteraChargeRow> Upcoming { get; init; } = [];
    public bool HasOverdue { get; init; }

    // False for the "Anteriores" rows: that debt is shown for reference and never notified.
    public bool ShowNotify { get; init; } = true;

    public string NotifyText => !HasOverdue ? "Nada vencido" : CanNotify ? "Notificar" : "No disponible";
    public bool HasUpcoming => Upcoming.Count > 0;
    public bool HasCaption => CaptionText.Length > 0;
    public bool CaptionIsDone => CanNotify && AlreadyNotifiedToday;
    public bool HasRent => Rent.Count > 0;
}

// Pure display shaping for the Cartera timeline (012-cartera-vencida-timeline, Constitution II):
// wording and numbers come from CarteraFormatting/CopCurrencyFormatter; the page only maps the
// result onto MAUI types.
public static class CarteraRowsBuilder
{
    public static string MonthKey(int year, int month) => $"m:{year}-{month}";

    public static MonthSeverity SeverityOf(CarteraMonthModel month)
    {
        var oldest = month.Charges.Count == 0 ? 0 : month.Charges.Max(c => c.DaysOverdue);
        return oldest > 60 ? MonthSeverity.Severe : oldest > 30 ? MonthSeverity.Aging : MonthSeverity.Recent;
    }

    // Overdue charges drive each row's summary and notify action; "por vencer" charges are listed
    // under them and never sent (FR-021). An apartment may appear with only "por vencer" charges.
    public static List<CarteraApartmentRow> BuildApartments(
        IEnumerable<CarteraChargeModel> charges,
        IReadOnlyDictionary<long, CarteraApartmentModel> apartments,
        IEnumerable<CarteraChargeModel>? upcoming = null)
    {
        var overdueByApartment = charges.GroupBy(c => c.ApartmentId).ToDictionary(g => g.Key, g => g.ToList());
        var upcomingByApartment = (upcoming ?? []).GroupBy(c => c.ApartmentId).ToDictionary(g => g.Key, g => g.ToList());

        return overdueByApartment.Keys.Union(upcomingByApartment.Keys)
            .Select(id => BuildApartment(
                id,
                overdueByApartment.GetValueOrDefault(id) ?? [],
                upcomingByApartment.GetValueOrDefault(id) ?? [],
                apartments))
            .OrderBy(r => r.Number, StringComparer.Ordinal)
            .ToList();
    }

    // The rows inside the "Anteriores" entry: one row per apartment, every charge labeled with its
    // own month and year, no notify action and no reachability caption.
    public static List<CarteraApartmentRow> BuildAnterioresApartments(
        IEnumerable<CarteraPeriodCharge> charges,
        IReadOnlyDictionary<long, CarteraApartmentModel> apartments) =>
        charges
            .GroupBy(c => c.Charge.ApartmentId)
            .Select(group =>
            {
                var first = group.First().Charge;
                CarteraChargeRow ToRow(CarteraPeriodCharge c) => new(
                    CarteraFormatting.PeriodChargeLabel(c.Charge.Service, c.Month, c.Year),
                    CarteraFormatting.AmountDisplay(c.Charge.Amount),
                    c.Charge.Amount is null,
                    CarteraFormatting.DaysLabel(c.Charge.DaysOverdue));

                return new CarteraApartmentRow
                {
                    ApartmentId = group.Key,
                    Number = first.ApartmentNumber,
                    OwnerDisplay = string.IsNullOrWhiteSpace(first.Owner) ? "Sin propietario" : first.Owner,
                    Summary = CarteraFormatting.ApartmentSummary(group.Count(), group.Sum(c => c.Charge.Amount ?? 0m)),
                    HasOverdue = true,
                    ShowNotify = false,
                    Services = group.Where(c => !c.Charge.IsRent).Select(ToRow).ToList(),
                    Rent = group.Where(c => c.Charge.IsRent).Select(ToRow).ToList(),
                };
            })
            .OrderBy(r => r.Number, StringComparer.Ordinal)
            .ToList();

    private static CarteraApartmentRow BuildApartment(
        long apartmentId,
        List<CarteraChargeModel> charges,
        List<CarteraChargeModel> upcoming,
        IReadOnlyDictionary<long, CarteraApartmentModel> apartments)
    {
        apartments.TryGetValue(apartmentId, out var summary);
        var first = charges.Count > 0 ? charges[0] : upcoming[0];
        var hasOverdue = charges.Count > 0;
        var canNotify = hasOverdue && (summary?.CanNotify ?? false);

        string caption;
        if (!hasOverdue)
        {
            caption = string.Empty; // nothing to notify about, so no reachability reason either
        }
        else if (!canNotify)
        {
            caption = summary?.CannotNotifyReason ?? string.Empty;
        }
        else if (summary is { NotifiedToday: true, LastNotifiedAt: DateTime last })
        {
            caption = $"Ya se notificó hoy · {last.ToLocalTime().ToString("HH:mm", CultureInfo.InvariantCulture)}";
        }
        else
        {
            caption = string.Empty;
        }

        static CarteraChargeRow ToRow(CarteraChargeModel c) =>
            new(c.Service, CarteraFormatting.AmountDisplay(c.Amount), c.Amount is null, CarteraFormatting.DaysLabel(c.DaysOverdue));

        static CarteraChargeRow ToUpcomingRow(CarteraChargeModel c) =>
            new(c.Service, CarteraFormatting.AmountDisplay(c.Amount), c.Amount is null, CarteraFormatting.DueInLabel(c.DaysUntilDue ?? 0));

        var summaryText = hasOverdue
            ? CarteraFormatting.ApartmentSummary(charges.Count, charges.Sum(c => c.Amount ?? 0m))
            : "Nada vencido";
        if (upcoming.Count > 0)
        {
            summaryText += $" · {CarteraFormatting.UpcomingCount(upcoming.Count)}";
        }

        return new CarteraApartmentRow
        {
            ApartmentId = apartmentId,
            Number = first.ApartmentNumber,
            OwnerDisplay = string.IsNullOrWhiteSpace(first.Owner) ? "Sin propietario" : first.Owner,
            // The row (and its notice) covers the month it sits under, not the apartment's whole balance.
            Summary = summaryText,
            HasOverdue = hasOverdue,
            CanNotify = canNotify,
            AlreadyNotifiedToday = summary?.NotifiedToday ?? false,
            CaptionText = caption,
            Services = charges.Where(c => !c.IsRent).Select(ToRow).ToList(),
            Rent = charges.Where(c => c.IsRent).Select(ToRow).ToList(),
            Upcoming = upcoming.Select(ToUpcomingRow).ToList(),
        };
    }
}
