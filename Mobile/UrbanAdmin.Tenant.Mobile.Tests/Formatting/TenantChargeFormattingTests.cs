using UrbanAdmin.Tenant.Mobile.Core.Formatting;

namespace UrbanAdmin.Tenant.Mobile.Tests.Formatting;

// 013-tenant-pagos-alertas-redesign T009: every word the redesigned tenant Pagos and Alertas screens
// show is produced here (Core), so wording, dates and pesos are unit-tested instead of living in XAML
// code-behind. "Today" is the Colombian local date (fixed UTC-5), always injected.
public class TenantChargeFormattingTests
{
    private static readonly DateTime Today = new(2026, 9, 16);

    private static DateTime Utc(int y, int m, int d, int h = 12) => new(y, m, d, h, 0, 0, DateTimeKind.Utc);

    // ---- status chip ------------------------------------------------------------------------

    [Theory]
    [InlineData("paid", "Pagado")]
    [InlineData("overdue", "Vencido")]
    [InlineData("due-today", "Vence hoy")]
    [InlineData("due-soon", "Vence en 2 días")]
    [InlineData("not-due", "Pendiente")]
    [InlineData("anything-else", "Pendiente")]
    public void StatusLabel_IsTheSameChipTextOnPagosAndAlertas(string status, string expected)
    {
        Assert.Equal(expected, TenantChargeFormatting.StatusLabel(status));
    }

    // ---- Pagos date line ----------------------------------------------------------------------

    [Fact]
    public void DateLine_UnpaidChargeNamesItsDueDate()
    {
        Assert.Equal("VENCE EL 15 SEP", TenantChargeFormatting.DateLine(false, new DateTime(2026, 9, 15), null));
        Assert.Equal("VENCE EL 1 OCT", TenantChargeFormatting.DateLine(false, new DateTime(2026, 10, 1), null));
    }

    [Fact]
    public void DateLine_PaidChargeWithAPaidDate_NamesTheDayItWasPaid_InColombianTime()
    {
        // 2026-09-06 02:30Z is still the 5th in Colombia (UTC-5).
        Assert.Equal("PAGADO EL 5 SEP", TenantChargeFormatting.DateLine(true, new DateTime(2026, 9, 1), new DateTime(2026, 9, 6, 2, 30, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public void DateLine_PaidChargeWithoutAPaidDate_IsJustPagado()
    {
        Assert.Equal("PAGADO", TenantChargeFormatting.DateLine(true, new DateTime(2026, 9, 5), null));
    }

    [Fact]
    public void DateLine_UnpaidChargeWithNoDueDate_SaysSinFechaLimite()
    {
        Assert.Equal("SIN FECHA LÍMITE", TenantChargeFormatting.DateLine(false, default, null));
    }

    // ---- short and relative dates -------------------------------------------------------------

    [Fact]
    public void ShortDate_IsDayAndAbbreviatedMonth_WithTheYearWhenNotThisYear()
    {
        Assert.Equal("5 sep", TenantChargeFormatting.ShortDate(new DateTime(2026, 9, 5), Today));
        Assert.Equal("19 ago", TenantChargeFormatting.ShortDate(new DateTime(2026, 8, 19), Today));
        Assert.Equal("30 dic 2025", TenantChargeFormatting.ShortDate(new DateTime(2025, 12, 30), Today));
    }

    [Fact]
    public void RelativeDate_UsesTheColombianDay_HoyAyerOrAShortDate()
    {
        Assert.Equal("hoy", TenantChargeFormatting.RelativeDate(Utc(2026, 9, 16, 14), Today));
        Assert.Equal("ayer", TenantChargeFormatting.RelativeDate(Utc(2026, 9, 15, 20), Today));
        Assert.Equal("5 sep", TenantChargeFormatting.RelativeDate(Utc(2026, 9, 5, 15), Today));
        Assert.Equal("30 dic 2025", TenantChargeFormatting.RelativeDate(Utc(2025, 12, 30, 15), Today));
    }

    [Fact]
    public void RelativeDate_AnEveningInstantBelongsToThatColombianDay_NotTheNextUtcDay()
    {
        // 2026-09-17 01:30Z is 20:30 on the 16th in Colombia = "hoy".
        Assert.Equal("hoy", TenantChargeFormatting.RelativeDate(new DateTime(2026, 9, 17, 1, 30, 0, DateTimeKind.Utc), Today));
    }

    [Fact]
    public void LocalDate_ConvertsAnInstantToTheColombianDate()
    {
        Assert.Equal(new DateTime(2026, 9, 5), TenantChargeFormatting.LocalDate(new DateTime(2026, 9, 6, 2, 30, 0, DateTimeKind.Utc)));
        Assert.Equal(new DateTime(2026, 9, 6), TenantChargeFormatting.LocalDate(new DateTime(2026, 9, 6, 5, 0, 0, DateTimeKind.Utc)));
    }

    // ---- Alertas cards -------------------------------------------------------------------------

    [Fact]
    public void AlertTitle_IsServiceDotMonthInLowercase()
    {
        Assert.Equal("Energía · septiembre", TenantChargeFormatting.AlertTitle("Energía", 9));
        Assert.Equal("Gas · agosto", TenantChargeFormatting.AlertTitle("Gas", 8));
    }

    [Fact]
    public void PaymentAlertText_DueSoon_NamesTheDueDateAndTheValue()
    {
        Assert.Equal("Vence el 18 de septiembre. Valor $132.900.", TenantChargeFormatting.PaymentAlertText("due-soon", new DateTime(2026, 9, 18), 132900m));
    }

    [Fact]
    public void PaymentAlertText_DueToday_AndOverdue()
    {
        Assert.Equal("Vence hoy. Valor $86.400.", TenantChargeFormatting.PaymentAlertText("due-today", new DateTime(2026, 9, 16), 86400m));
        Assert.Equal("Venció el 15 de septiembre. Valor $86.400.", TenantChargeFormatting.PaymentAlertText("overdue", new DateTime(2026, 9, 15), 86400m));
    }

    [Theory]
    [InlineData("due-soon", "Vence el 18 de septiembre.")]
    [InlineData("due-today", "Vence hoy.")]
    [InlineData("overdue", "Venció el 18 de septiembre.")]
    public void PaymentAlertText_WithoutAnAmount_OmitsTheValueSentence(string status, string expected)
    {
        Assert.Equal(expected, TenantChargeFormatting.PaymentAlertText(status, new DateTime(2026, 9, 18), null));
    }

    [Fact]
    public void ConfirmationText_NamesTheAmountWhenKnown()
    {
        Assert.Equal("Recibimos tu pago de $420.000.", TenantChargeFormatting.ConfirmationText(420000m));
        Assert.Equal("Recibimos tu pago.", TenantChargeFormatting.ConfirmationText(null));
    }

    [Fact]
    public void ConfirmationAndAnnouncementChips_AreFixedWords()
    {
        Assert.Equal("Pago confirmado", TenantChargeFormatting.ConfirmationChip);
        Assert.Equal("Comunicado", TenantChargeFormatting.AnnouncementChip);
    }

    // ---- header kicker --------------------------------------------------------------------------

    [Theory]
    [InlineData("502", "Laura Gómez", "APTO 502 · LAURA GÓMEZ")]
    [InlineData("502", null, "APTO 502")]
    [InlineData("502", "  ", "APTO 502")]
    [InlineData(null, "Laura Gómez", "LAURA GÓMEZ")]
    [InlineData("", "", "")]
    [InlineData(null, null, "")]
    public void HeaderKicker_IsUppercaseAndNeverShowsNull(string? apartment, string? owner, string expected)
    {
        Assert.Equal(expected, TenantChargeFormatting.HeaderKicker(apartment, owner));
    }
}
