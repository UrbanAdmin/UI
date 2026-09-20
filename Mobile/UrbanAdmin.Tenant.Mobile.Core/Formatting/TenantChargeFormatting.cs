using System.Globalization;

namespace UrbanAdmin.Tenant.Mobile.Core.Formatting;

// 013-tenant-pagos-alertas-redesign: every word and date the redesigned tenant Pagos and Alertas
// screens show. Kept in Core (pure, no colors, "today" always injected) so it is unit-tested; the
// pages only map the results onto MAUI controls. Dates use the building's local day, Colombia
// standard time = a fixed UTC-5 (no DST), the same rule the Backend applies to statuses.
public static class TenantChargeFormatting
{
    private static readonly TimeSpan ColombiaOffset = TimeSpan.FromHours(-5);

    public const string ConfirmationChip = "Pago confirmado";
    public const string AnnouncementChip = "Comunicado";

    // The Colombian calendar date of a UTC instant (00:00, Kind unspecified).
    public static DateTime LocalDate(DateTime utc) => (utc + ColombiaOffset).Date;

    // One chip text per status, identical on Pagos and Alertas (FR-005).
    public static string StatusLabel(string? status) => status switch
    {
        "paid" => "Pagado",
        "overdue" => "Vencido",
        "due-today" => "Vence hoy",
        "due-soon" => "Vence en 2 días",
        _ => "Pendiente",
    };

    // The small uppercase line above a charge in the Pagos timeline.
    public static string DateLine(bool paid, DateTime dueDate, DateTime? paidAtUtc)
    {
        if (paid)
        {
            return paidAtUtc is DateTime at ? $"PAGADO EL {Day(LocalDate(at))}" : "PAGADO";
        }

        return dueDate.Date == default ? "SIN FECHA LÍMITE" : $"VENCE EL {Day(dueDate)}";
    }

    // "5 sep", or "30 dic 2025" when it is not the current year.
    public static string ShortDate(DateTime localDate, DateTime todayLocal)
    {
        var text = $"{localDate.Day} {CarteraFormatting.MonthAbbreviation(localDate.Month)}";
        return localDate.Year == todayLocal.Year ? text : $"{text} {localDate.Year}";
    }

    // "hoy", "ayer" or a short date, judged on the Colombian day of the instant.
    public static string RelativeDate(DateTime atUtc, DateTime todayLocal)
    {
        var day = LocalDate(atUtc);
        var diff = (todayLocal.Date - day).Days;
        return diff switch
        {
            0 => "hoy",
            1 => "ayer",
            _ => ShortDate(day, todayLocal),
        };
    }

    // "Energía · septiembre"
    public static string AlertTitle(string utility, int month) =>
        $"{utility} · {CarteraFormatting.MonthName(month).ToLowerInvariant()}";

    // "Vence el 18 de septiembre. Valor $132.900." / "Vence hoy. ..." / "Venció el 15 de septiembre. ...";
    // the "Valor" sentence is omitted when the charge has no recorded amount.
    public static string PaymentAlertText(string status, DateTime dueDate, decimal? amountValue)
    {
        var when = status switch
        {
            "due-today" => "Vence hoy.",
            "overdue" => $"Venció el {LongDay(dueDate)}.",
            _ => $"Vence el {LongDay(dueDate)}.",
        };

        return amountValue is decimal value ? $"{when} Valor {CopCurrencyFormatter.Format(value)}." : when;
    }

    public static string ConfirmationText(decimal? amountValue) =>
        amountValue is decimal value ? $"Recibimos tu pago de {CopCurrencyFormatter.Format(value)}." : "Recibimos tu pago.";

    // "APTO 502 · LAURA GÓMEZ": uppercase, whichever part exists, never "null".
    public static string HeaderKicker(string? apartmentNumber, string? ownerName)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(apartmentNumber))
        {
            parts.Add($"APTO {apartmentNumber.Trim().ToUpperInvariant()}");
        }

        if (!string.IsNullOrWhiteSpace(ownerName))
        {
            parts.Add(ownerName.Trim().ToUpperInvariant());
        }

        return string.Join(" · ", parts);
    }

    private static string Day(DateTime date) =>
        $"{date.Day.ToString(CultureInfo.InvariantCulture)} {CarteraFormatting.MonthAbbreviation(date.Month).ToUpperInvariant()}";

    private static string LongDay(DateTime date) =>
        $"{date.Day.ToString(CultureInfo.InvariantCulture)} de {CarteraFormatting.MonthName(date.Month).ToLowerInvariant()}";
}
