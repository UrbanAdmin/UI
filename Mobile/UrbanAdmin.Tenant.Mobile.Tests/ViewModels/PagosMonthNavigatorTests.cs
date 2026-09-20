using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 013-tenant-pagos-alertas-redesign T016: the month navigator (previous/next arrows) of the tenant
// Pagos. It moves one month per step across year boundaries within the range the tenant could already
// reach (January of currentYear-3 through December of currentYear+1) and reports the ends so the
// arrows can disable (FR-002).
public class PagosMonthNavigatorTests
{
    private static PagosMonthNavigator Build(int year = 2026, int month = 9) =>
        new(() => new DateTime(year, month, 16));

    [Fact]
    public void StartsOnTheCurrentMonthAndYear()
    {
        var nav = Build();

        Assert.Equal((9, 2026), (nav.Month, nav.Year));
        Assert.Equal("Septiembre 2026", nav.Label);
    }

    [Fact]
    public void NextAndPrevious_MoveExactlyOneMonth()
    {
        var nav = Build();

        Assert.True(nav.Next());
        Assert.Equal((10, 2026), (nav.Month, nav.Year));
        Assert.True(nav.Previous());
        Assert.True(nav.Previous());
        Assert.Equal((8, 2026), (nav.Month, nav.Year));
    }

    [Fact]
    public void CrossesYearBoundariesInBothDirections()
    {
        var nav = Build(2026, 1);
        Assert.True(nav.Previous());
        Assert.Equal((12, 2025), (nav.Month, nav.Year));

        var dec = Build(2026, 12);
        Assert.True(dec.Next());
        Assert.Equal((1, 2027), (dec.Month, dec.Year));
    }

    [Fact]
    public void TheRangeStartsInJanuaryThreeYearsBack_AndThePreviousArrowStopsThere()
    {
        var nav = Build();
        nav.Set(1, 2023);

        Assert.False(nav.CanGoPrevious);
        Assert.False(nav.Previous());
        Assert.Equal((1, 2023), (nav.Month, nav.Year));
        Assert.True(nav.CanGoNext);
    }

    [Fact]
    public void TheRangeEndsInDecemberOfNextYear_AndTheNextArrowStopsThere()
    {
        var nav = Build();
        nav.Set(12, 2027);

        Assert.False(nav.CanGoNext);
        Assert.False(nav.Next());
        Assert.Equal((12, 2027), (nav.Month, nav.Year));
        Assert.True(nav.CanGoPrevious);
    }

    [Fact]
    public void TheCurrentMonthIsInTheMiddleOfTheRange_BothArrowsEnabled()
    {
        var nav = Build();

        Assert.True(nav.CanGoPrevious);
        Assert.True(nav.CanGoNext);
    }

    [Fact]
    public void Set_ClampsAMonthOutsideTheRangeToTheNearestEnd()
    {
        var nav = Build();

        nav.Set(3, 2019);
        Assert.Equal((1, 2023), (nav.Month, nav.Year));

        nav.Set(6, 2035);
        Assert.Equal((12, 2027), (nav.Month, nav.Year));
    }

    [Fact]
    public void TheRangeFollowsTheClock()
    {
        var nav = Build(2027, 2);
        nav.Set(1, 2024);

        Assert.False(nav.CanGoPrevious); // 2027 - 3 = 2024
        nav.Set(12, 2028);
        Assert.False(nav.CanGoNext);      // 2027 + 1 = 2028
    }
}
