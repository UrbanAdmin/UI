using UrbanAdmin.Tenant.Mobile.Core.Formatting;

namespace UrbanAdmin.Tenant.Mobile.Tests.Formatting;

public class LecturasFormattingTests
{
    [Fact]
    public void FormatConsumption_AppendsTheUnitWithAnEsCoCommaDecimal()
    {
        Assert.Equal("3,694 m³", LecturasFormatting.FormatConsumption("3.694", "m³"));
    }

    [Fact]
    public void FormatConsumption_ReturnsEmptyForNull()
    {
        Assert.Equal(string.Empty, LecturasFormatting.FormatConsumption(null, "m³"));
    }

    [Fact]
    public void FormatPercentage_MultipliesBy100AndUsesTheEsCoComma()
    {
        Assert.Equal("10,79%", LecturasFormatting.FormatPercentage("0.1079"));
    }

    [Fact]
    public void FormatPercentage_DropsTrailingZerosForAnExactValue()
    {
        Assert.Equal("30%", LecturasFormatting.FormatPercentage("0.3"));
    }

    [Fact]
    public void FormatPercentage_ReturnsEmptyForNull()
    {
        Assert.Equal(string.Empty, LecturasFormatting.FormatPercentage(null));
    }

    [Fact]
    public void FormatPeriodRange_SpellsOutBothDatesInWords()
    {
        var text = LecturasFormatting.FormatPeriodRange(new DateTime(2026, 9, 10), new DateTime(2026, 10, 7));

        Assert.Equal("10 de septiembre de 2026 - 7 de octubre de 2026", text);
    }
}
