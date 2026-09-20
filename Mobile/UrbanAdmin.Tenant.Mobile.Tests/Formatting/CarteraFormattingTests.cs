using UrbanAdmin.Tenant.Mobile.Core.Formatting;

namespace UrbanAdmin.Tenant.Mobile.Tests.Formatting;

// 012-cartera-vencida-timeline: all display text of the Cartera screen is produced here (Core), so
// wording, pluralization and peso formatting are unit-tested instead of living in XAML code-behind.
public class CarteraFormattingTests
{
    [Theory]
    [InlineData(7, 5, "7 conceptos en 5 apartamentos")]
    [InlineData(1, 1, "1 concepto en 1 apartamento")]
    [InlineData(2, 1, "2 conceptos en 1 apartamento")]
    [InlineData(1, 2, "1 concepto en 2 apartamentos")]
    public void Summary_PluralizesConceptsAndApartments(int charges, int apartments, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.Summary(charges, apartments));
    }

    [Theory]
    [InlineData(3, 2, "3 conceptos · 2 apartamentos")]
    [InlineData(1, 1, "1 concepto · 1 apartamento")]
    public void MonthSummary_UsesADotSeparator(int charges, int apartments, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.MonthSummary(charges, apartments));
    }

    [Theory]
    [InlineData(1, "1 día")]
    [InlineData(2, "2 días")]
    [InlineData(12, "12 días")]
    [InlineData(283, "283 días")]
    public void DaysLabel_PluralizesDays(int days, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.DaysLabel(days));
    }

    [Theory]
    [InlineData(1, "Enero")]
    [InlineData(9, "Septiembre")]
    [InlineData(12, "Diciembre")]
    public void MonthName_IsCapitalizedSpanish(int month, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.MonthName(month));
    }

    [Fact]
    public void MonthLabel_JoinsMonthAndYear()
    {
        Assert.Equal("Septiembre 2026", CarteraFormatting.MonthLabel(9, 2026));
    }

    [Fact]
    public void AmountDisplay_FormatsPesosAndFlagsMissingAmounts()
    {
        Assert.Equal("$91.200", CarteraFormatting.AmountDisplay(91200m));
        Assert.Equal("$1.600.000", CarteraFormatting.AmountDisplay(1600000m));
        Assert.Equal("$0", CarteraFormatting.AmountDisplay(0m));
        Assert.Equal("sin monto", CarteraFormatting.AmountDisplay(null));
    }

    [Fact]
    public void SplitLabels_NameTheServiciosAndArriendoParts()
    {
        Assert.Equal("Servicios $511.200", CarteraFormatting.ServiciosLabel(511200m));
        Assert.Equal("Arriendo $1.600.000", CarteraFormatting.ArriendoLabel(1600000m));
        Assert.Equal("Servicios $0", CarteraFormatting.ServiciosLabel(0m));
    }

    [Fact]
    public void ApartmentSummary_CountsTheMonthsChargesWithTheirTotal()
    {
        Assert.Equal("3 conceptos vencidos · $2.111.200", CarteraFormatting.ApartmentSummary(3, 2111200m));
        Assert.Equal("1 concepto vencido · $91.200", CarteraFormatting.ApartmentSummary(1, 91200m));
    }

    [Theory]
    [InlineData(0, "Vence hoy")]
    [InlineData(1, "Vence en 1 día")]
    [InlineData(25, "Vence en 25 días")]
    public void DueInLabel_NamesTheDaysLeft(int days, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.DueInLabel(days));
    }

    [Fact]
    public void PorVencerLabel_UsesTheAppWidePesoFormat()
    {
        Assert.Equal("Por vencer $840.000", CarteraFormatting.PorVencerLabel(840000m));
    }

    [Theory]
    [InlineData(3, 2, "3 conceptos · 2 apartamentos")]
    [InlineData(0, 0, "Nada vencido")]
    public void MonthOverdueSummary_SaysNothingOverdueForAnEmptyMonth(int charges, int apartments, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.MonthOverdueSummary(charges, apartments));
    }

    [Theory]
    [InlineData(1, "1 por vencer")]
    [InlineData(3, "3 por vencer")]
    public void UpcomingCount_IsNeverPluralized(int count, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.UpcomingCount(count));
    }

    [Theory]
    [InlineData(1, "ene")]
    [InlineData(9, "sep")]
    [InlineData(12, "dic")]
    public void MonthAbbreviation_IsTheThreeLetterSpanishName(int month, string expected)
    {
        Assert.Equal(expected, CarteraFormatting.MonthAbbreviation(month));
    }

    [Fact]
    public void PeriodChargeLabel_AddsTheBillingPeriodToTheService()
    {
        Assert.Equal("Agua · nov 2024", CarteraFormatting.PeriodChargeLabel("Agua", 11, 2024));
    }

    [Fact]
    public void AnterioresTexts_NameTheFirstMonthOfTheRange()
    {
        Assert.Equal("Antes de enero 2025", CarteraFormatting.AnterioresChip(2025));
        Assert.Equal("Deuda anterior a enero 2025. No se incluye en «Enviar notificación».", CarteraFormatting.AnterioresNote(2025));
    }
}
