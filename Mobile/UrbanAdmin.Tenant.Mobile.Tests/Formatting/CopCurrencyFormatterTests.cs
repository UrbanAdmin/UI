using UrbanAdmin.Tenant.Mobile.Core.Formatting;

namespace UrbanAdmin.Tenant.Mobile.Tests.Formatting;

public class CopCurrencyFormatterTests
{
    [Fact]
    public void Format_Decimal_UsesDollarPrefixAndPeriodThousandsSeparatorWithNoDecimals()
    {
        var result = CopCurrencyFormatter.Format(107000m);

        Assert.Equal("$107.000", result);
    }

    [Fact]
    public void Format_String_ParsesAndFormatsANumericString()
    {
        var result = CopCurrencyFormatter.Format("45000");

        Assert.Equal("$45.000", result);
    }

    [Fact]
    public void Format_String_ReturnsNonNumericStringsUnchanged()
    {
        var result = CopCurrencyFormatter.Format("Sin registrar");

        Assert.Equal("Sin registrar", result);
    }

    [Fact]
    public void Format_String_ReturnsAnEmDashForNull()
    {
        var result = CopCurrencyFormatter.Format((string?)null);

        Assert.Equal("—", result);
    }
}
