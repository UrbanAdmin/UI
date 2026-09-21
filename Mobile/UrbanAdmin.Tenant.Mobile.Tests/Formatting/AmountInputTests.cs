using UrbanAdmin.Tenant.Mobile.Core.Formatting;

namespace UrbanAdmin.Tenant.Mobile.Tests.Formatting;

// 014-admin-pagos-first-tab US4: the amount field of the edit screen shows "$420.000" at rest and the plain
// digits while it is being edited; what the administrator types is reduced to digits before saving.
public class AmountInputTests
{
    [Theory]
    [InlineData("420000", "420000")]
    [InlineData("$420.000", "420000")]
    [InlineData(" 45 000 ", "45000")]
    [InlineData("0", "0")]
    public void Parse_KeepsOnlyTheDigits(string typed, string expected) =>
        Assert.Equal(expected, AmountInput.Parse(typed));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("$")]
    [InlineData("abc")]
    public void Parse_ReturnsNullWhenThereAreNoDigits(string? typed) =>
        Assert.Null(AmountInput.Parse(typed));

    [Theory]
    [InlineData("420000", "$420.000")]
    [InlineData("0", "$0")]
    [InlineData("86400", "$86.400")]
    public void Display_FormatsPesos(string amount, string expected) =>
        Assert.Equal(expected, AmountInput.Display(amount));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Display_IsEmptyWithoutAnAmount(string? amount) =>
        Assert.Equal(string.Empty, AmountInput.Display(amount));

    [Fact]
    public void Display_ReadsAnUnparseableStoredAmountAsEmpty() =>
        Assert.Equal(string.Empty, AmountInput.Display("not-a-number"));

    [Theory]
    [InlineData("420000", "420000")]
    [InlineData(null, "")]
    public void Raw_IsTheDigitsForEditing(string? amount, string expected) =>
        Assert.Equal(expected, AmountInput.Raw(amount));
}
