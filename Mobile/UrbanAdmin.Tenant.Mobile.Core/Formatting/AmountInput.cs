using System.Globalization;

namespace UrbanAdmin.Tenant.Mobile.Core.Formatting;

// 014-admin-pagos-first-tab US4: the amount field of the admin edit screen. At rest it reads "$420.000"; while it is
// being edited it holds the plain digits; whatever the administrator typed is reduced to digits before it is saved
// (the amount travels as a digit string, as it did before this screen was restyled).
public static class AmountInput
{
    // Digits only, or null when the field holds no digit at all.
    public static string? Parse(string? typed)
    {
        if (string.IsNullOrWhiteSpace(typed))
        {
            return null;
        }

        var digits = new string(typed.Where(char.IsAsciiDigit).ToArray());
        return digits.Length == 0 ? null : digits;
    }

    // "$420.000" for a stored amount; empty when there is none (or it cannot be read).
    public static string Display(string? amount) =>
        decimal.TryParse(amount, NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
            ? CopCurrencyFormatter.Format(value)
            : string.Empty;

    // What the field holds while it has focus.
    public static string Raw(string? amount) => amount ?? string.Empty;
}
