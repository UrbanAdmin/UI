using System.Globalization;

namespace UrbanAdmin.Tenant.Mobile.Core.Formatting;

// Colombian peso convention: "$" prefix, period as the thousands separator, no decimals
// (es-CO's NumberFormatInfo already produces the period separator). Extracted from
// AdminPagosPage.xaml.cs (008-mobile-admin-views) so Pagos/Notificaciones can share it
// (009-tenant-pagos-period-pesos) instead of reimplementing the same rule a third time.
public static class CopCurrencyFormatter
{
    private static readonly CultureInfo AmountCulture = new("es-CO");

    public static string Format(decimal amount) => $"${amount.ToString("N0", AmountCulture)}";

    public static string Format(string? amount) =>
        amount is not null && decimal.TryParse(amount, out var parsed) ? Format(parsed) : amount ?? "—";
}
