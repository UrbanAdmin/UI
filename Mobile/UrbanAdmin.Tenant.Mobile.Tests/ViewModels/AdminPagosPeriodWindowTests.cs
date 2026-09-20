using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 012-cartera-vencida-timeline US2: the detailed Pagos screen's year picker shows a sliding
// window (last year .. +5). A Cartera month can be older than that (overdue debt keeps aging), so
// opening Pagos "on that month" must widen the window instead of leaving the picker on -1.
public class AdminPagosPeriodWindowTests
{
    [Fact]
    public void YearsFor_DefaultsToTheSevenYearWindowStartingLastYear()
    {
        Assert.Equal([2025, 2026, 2027, 2028, 2029, 2030, 2031], AdminPagosPeriodWindow.YearsFor(2026));
    }

    [Fact]
    public void YearsFor_KeepsTheDefaultWindowWhenTheRequestedYearIsInsideIt()
    {
        Assert.Equal([2025, 2026, 2027, 2028, 2029, 2030, 2031], AdminPagosPeriodWindow.YearsFor(2026, requestedYear: 2028));
    }

    [Fact]
    public void YearsFor_IncludesAnOlderRequestedYear_AndStaysAscendingWithoutDuplicates()
    {
        var years = AdminPagosPeriodWindow.YearsFor(2026, requestedYear: 2023);

        Assert.Equal(2023, years[0]);
        Assert.Contains(2026, years);
        Assert.Equal(years.OrderBy(y => y), years);
        Assert.Equal(years.Distinct().Count(), years.Count);
    }

    [Fact]
    public void YearsFor_IncludesANewerRequestedYear()
    {
        var years = AdminPagosPeriodWindow.YearsFor(2026, requestedYear: 2033);

        Assert.Equal(2033, years[^1]);
        Assert.Contains(2026, years);
    }
}
