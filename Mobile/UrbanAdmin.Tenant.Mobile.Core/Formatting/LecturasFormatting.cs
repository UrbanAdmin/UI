using System.Globalization;

namespace UrbanAdmin.Tenant.Mobile.Core.Formatting;

// 029-tenant-mobile-lecturas: consumption/percentage/period-range text for the tenant Lecturas
// statement - the Colombian decimal comma this app's existing CopCurrencyFormatter doesn't need
// (money has no decimals), mirroring the Angular web app's shared/es-number.ts rules from 028.
public static class LecturasFormatting
{
    public static string FormatConsumption(string? value, string? unit)
    {
        var text = FormatDecimal(value);
        if (text.Length == 0)
        {
            return string.Empty;
        }
        return string.IsNullOrEmpty(unit) ? text : $"{text} {unit}";
    }

    // "292.157" (invariant) -> "292,157"; returns "" for null/unparseable input.
    public static string FormatDecimal(string? value) =>
        decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed.ToString(CultureInfo.InvariantCulture).Replace('.', ',')
            : string.Empty;

    // "0.1079" -> "10,79%"; "0.3" -> "30%" (trailing zeros dropped, matching the web pipe's rule).
    public static string FormatPercentage(string? value)
    {
        if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
        {
            return string.Empty;
        }
        var percent = Math.Round(parsed * 100, 2, MidpointRounding.AwayFromZero);
        return percent.ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ',') + "%";
    }

    // "10 de septiembre de 2026 - 7 de octubre de 2026" - mirrors the web app's
    // notifications/month-names.ts formatDateInWords from 028's own period picker work.
    public static string FormatPeriodRange(DateTime start, DateTime end) =>
        $"{FormatDateInWords(start)} - {FormatDateInWords(end)}";

    private static string FormatDateInWords(DateTime date) =>
        $"{date.Day} de {CarteraFormatting.MonthName(date.Month).ToLowerInvariant()} de {date.Year}";
}
