using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 014-admin-pagos-first-tab: display model of the admin Pagos tab (approved mockup): one card for the selected
// month; inside it one row per apartment (with its arrendatario) that lists every service, and the amount still
// owed. Plain rows so the XAML only maps them to MAUI types.

// One service of an apartment, as the subtitle chip list ("Agua, Energía, Gas") needs it.
public record AdminPagosServiceChip(string Name, bool IsPending);

// One service of an apartment, as the expanded line needs it. StatusKind is "paid", "pending" or "placeholder".
public record AdminPagosServiceLine(string Utility, string DeadlineText, string AmountDisplay, string StatusLabel, string StatusKind);

public record AdminPagosApartmentRow(
    string Number,
    string Title,
    IReadOnlyList<AdminPagosServiceChip> Services,
    IReadOnlyList<AdminPagosServiceLine> Lines,
    decimal AmountOwed)
{
    public bool IsUpToDate => AmountOwed == 0m;

    public string OwedDisplay => IsUpToDate ? "Al día" : CopCurrencyFormatter.Format(AmountOwed);
}

public record AdminPagosMonthCardModel(string Title, string Summary, decimal TotalOwed, IReadOnlyList<AdminPagosApartmentRow> Apartments)
{
    public bool AllUpToDate => TotalOwed == 0m;

    public string TotalDisplay => AllUpToDate ? "Al día" : CopCurrencyFormatter.Format(TotalOwed);
}

public static class AdminPagosMonthCard
{
    public static AdminPagosMonthCardModel Build(IEnumerable<AdminPagoRowModel> rows, int month, int year)
    {
        var apartments = rows
            .GroupBy(r => r.ApartmentId)
            .Select(g => ToApartment(g.ToList()))
            .OrderBy(a => a.Number, StringComparer.Ordinal)
            .ToList();

        var totalOwed = apartments.Sum(a => a.AmountOwed);
        var upToDate = apartments.Count(a => a.IsUpToDate);
        var summary = $"{CarteraFormatting.Apartments(apartments.Count)} · {upToDate} al día";

        return new AdminPagosMonthCardModel(CarteraFormatting.MonthLabel(month, year), summary, totalOwed, apartments);
    }

    private static AdminPagosApartmentRow ToApartment(List<AdminPagoRowModel> rows)
    {
        var first = rows[0];
        var owner = string.IsNullOrWhiteSpace(first.Owner) ? "Sin propietario" : first.Owner;

        var services = rows.Select(r => new AdminPagosServiceChip(r.Utility, IsPending(r))).ToList();
        var lines = rows.Select(ToLine).ToList();
        var owed = rows.Where(IsPending).Sum(r => ParseAmount(r.Amount));

        return new AdminPagosApartmentRow(first.ApartmentNumber, $"{first.ApartmentNumber} · {owner}", services, lines, owed);
    }

    // A placeholder (no PaymentStatus record yet) is not a charge, so it is never pending or owed.
    private static bool IsPending(AdminPagoRowModel row) => row.PaymentStatusId is not null && !row.Paid;

    private static decimal ParseAmount(string? amount) => decimal.TryParse(amount, out var value) ? value : 0m;

    private static AdminPagosServiceLine ToLine(AdminPagoRowModel row)
    {
        if (row.PaymentStatusId is null)
        {
            return new AdminPagosServiceLine(row.Utility, DeadlineText(row.DueDate), "Sin registrar", "Nada aún", "placeholder");
        }

        var amount = row.Amount is null ? "sin monto" : CopCurrencyFormatter.Format(row.Amount);
        return row.Paid
            ? new AdminPagosServiceLine(row.Utility, DeadlineText(row.DueDate), amount, "Pagado", "paid")
            : new AdminPagosServiceLine(row.Utility, DeadlineText(row.DueDate), amount, "Pendiente", "pending");
    }

    // No saved deadline comes back as the default date; it reads "Sin fecha".
    private static string DeadlineText(DateTime due) =>
        due.Year <= 1 ? "Sin fecha" : $"Vence el {due.Day} {CarteraFormatting.MonthAbbreviation(due.Month)}";
}
