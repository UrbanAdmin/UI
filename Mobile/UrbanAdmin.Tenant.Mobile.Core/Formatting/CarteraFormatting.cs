namespace UrbanAdmin.Tenant.Mobile.Core.Formatting;

// Display text for the Cartera screen (012-cartera-vencida-timeline). Kept in Core so wording,
// pluralization and peso formatting are unit-tested rather than living in XAML code-behind;
// pesos always go through CopCurrencyFormatter (the app-wide "$" + period-thousands rule).
public static class CarteraFormatting
{
    private static readonly string[] MonthNames =
    [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];

    public static string Summary(int chargeCount, int apartmentCount) =>
        $"{Concepts(chargeCount)} en {Apartments(apartmentCount)}";

    public static string MonthSummary(int chargeCount, int apartmentCount) =>
        $"{Concepts(chargeCount)} · {Apartments(apartmentCount)}";

    public static string ApartmentSummary(int chargeCount, decimal total) =>
        $"{chargeCount} {(chargeCount == 1 ? "concepto vencido" : "conceptos vencidos")} · {CopCurrencyFormatter.Format(total)}";

    // Month row summary: the overdue counts, or "Nada vencido" when the month has none (it may
    // still list "por vencer" charges).
    public static string MonthOverdueSummary(int chargeCount, int apartmentCount) =>
        chargeCount == 0 ? "Nada vencido" : MonthSummary(chargeCount, apartmentCount);

    public static string DueInLabel(int daysLeft) =>
        daysLeft <= 0 ? "Vence hoy" : daysLeft == 1 ? "Vence en 1 día" : $"Vence en {daysLeft} días";

    public static string PorVencerLabel(decimal amount) => $"Por vencer {CopCurrencyFormatter.Format(amount)}";

    public static string UpcomingCount(int count) => $"{count} por vencer";

    public static string DaysLabel(int days) => days == 1 ? "1 día" : $"{days} días";

    public static string MonthName(int month) => MonthNames[month - 1];

    public static string MonthLabel(int month, int year) => $"{MonthName(month)} {year}";

    public static string AmountDisplay(decimal? amount) =>
        amount is null ? "sin monto" : CopCurrencyFormatter.Format(amount.Value);

    public static string ServiciosLabel(decimal amount) => $"Servicios {CopCurrencyFormatter.Format(amount)}";

    public static string ArriendoLabel(decimal amount) => $"Arriendo {CopCurrencyFormatter.Format(amount)}";

    public static string Concepts(int count) => count == 1 ? "1 concepto" : $"{count} conceptos";

    public static string Apartments(int count) => count == 1 ? "1 apartamento" : $"{count} apartamentos";
}
