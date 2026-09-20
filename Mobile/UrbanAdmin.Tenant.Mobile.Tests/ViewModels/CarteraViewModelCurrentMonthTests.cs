using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 012-cartera-vencida-timeline, device round (FR-020, SC-009): no pickers. The screen works on the
// CURRENT month (from the clock), lists the months from the current one back through January of
// last year, folds older overdue debt into one "Anteriores" entry and hides future months.
public class CarteraViewModelCurrentMonthTests
{
    private static CarteraChargeModel Charge(long apartment, string service, decimal? amount, bool rent = false) =>
        new() { ApartmentId = apartment, ApartmentNumber = apartment.ToString(), Service = service, Amount = amount, IsRent = rent };

    private static CarteraChargeModel Upcoming(long apartment, string service, decimal? amount, int daysLeft) =>
        new() { ApartmentId = apartment, ApartmentNumber = apartment.ToString(), Service = service, Amount = amount, DaysUntilDue = daysLeft };

    private static CarteraMonthModel Month(int year, int month, CarteraChargeModel[] overdue, params CarteraChargeModel[] upcoming) => new()
    {
        Year = year,
        Month = month,
        Charges = overdue.ToList(),
        TotalServicios = overdue.Where(c => !c.IsRent).Sum(c => c.Amount ?? 0),
        TotalArriendo = overdue.Where(c => c.IsRent).Sum(c => c.Amount ?? 0),
        Total = overdue.Sum(c => c.Amount ?? 0),
        ChargeCount = overdue.Length,
        ApartmentCount = overdue.Select(c => c.ApartmentId).Distinct().Count(),
        UpcomingCharges = upcoming.ToList(),
        UpcomingServicios = upcoming.Sum(c => c.Amount ?? 0),
        UpcomingTotal = upcoming.Sum(c => c.Amount ?? 0),
        UpcomingChargeCount = upcoming.Length,
    };

    // Today = 2026-09-20, so the range is Jan 2025 .. Sep 2026.
    //   Sep 2026: 101 (Agua 40.000 + Arriendo 900.000), 202 (Luz sin monto), por vencer 101 Gas 12.000
    //   Aug 2026: 101 (Agua 30.000)          Jan 2025: 303 (Luz 7.000)   (edge of the range)
    //   Oct 2026: por vencer only (a FUTURE month - hidden)
    //   Dec 2024: 303 (Agua 5.000)           Mar 2024: 303 (Arriendo 1.450.000)   (-> "Anteriores")
    private static CarteraModel Sample() => new()
    {
        Years =
        [
            new CarteraYearModel
            {
                Year = 2026,
                Months =
                [
                    Month(2026, 10, [], Upcoming(1, "Agua", 96000m, 8)),
                    Month(2026, 9, [Charge(1, "Agua", 40000m), Charge(1, "Arriendo", 900000m, rent: true), Charge(2, "Luz", null)], Upcoming(1, "Gas", 12000m, 3)),
                    Month(2026, 8, [Charge(1, "Agua", 30000m)]),
                ],
            },
            new CarteraYearModel { Year = 2025, Months = [Month(2025, 1, [Charge(3, "Luz", 7000m)])] },
            new CarteraYearModel { Year = 2024, Months = [Month(2024, 12, [Charge(3, "Agua", 5000m)]), Month(2024, 3, [Charge(3, "Arriendo", 1450000m, rent: true)])] },
        ],
        Apartments =
        [
            new CarteraApartmentModel { ApartmentId = 1, ApartmentNumber = "101", Owner = "Carlos", ChargeCount = 3, Total = 970000m, CanNotify = true },
            new CarteraApartmentModel { ApartmentId = 2, ApartmentNumber = "202", Owner = "Yesenia", ChargeCount = 1, CanNotify = false, CannotNotifyReason = "Sin propietario activo" },
            new CarteraApartmentModel { ApartmentId = 3, ApartmentNumber = "303", Owner = "Luis", ChargeCount = 3, Total = 1462000m, CanNotify = true, NotifiedToday = true, LastNotifiedAt = new DateTime(2026, 9, 20, 14, 5, 0, DateTimeKind.Utc) },
        ],
    };

    private static async Task<(CarteraViewModel Vm, FakeAdminApiClient Api)> Build(CarteraModel? model = null, DateTime? now = null)
    {
        var api = new FakeAdminApiClient
        {
            CarteraResult = model ?? Sample(),
            NotificarResult = new CarteraNotifyResultModel { RequestedApartments = 1, NotifiedApartments = 1 },
        };
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync("admin-jwt");
        var clock = now ?? new DateTime(2026, 9, 20);
        var vm = new CarteraViewModel(api, tokens, new FakeCrashDiagnosticsService(), toLocalTime: utc => utc.AddHours(-5), today: () => clock);
        await vm.LoadAsync();
        return (vm, api);
    }

    private static List<(int Year, int Month)> Periods(IEnumerable<CarteraMonthModel> months) =>
        months.Select(m => (m.Year, m.Month)).ToList();

    // ---- current month ----------------------------------------------------------------------

    [Fact]
    public async Task CurrentMonth_ComesFromTheClock()
    {
        var (vm, _) = await Build();
        Assert.Equal((9, 2026), (vm.CurrentMonth, vm.CurrentYear));

        var (later, _) = await Build(now: new DateTime(2027, 1, 5));
        Assert.Equal((1, 2027), (later.CurrentMonth, later.CurrentYear));
    }

    [Fact]
    public async Task CurrentMonthEntry_IsTheOverdueAndUpcomingFiguresOfThisMonthOnly()
    {
        var (vm, _) = await Build();

        var entry = vm.CurrentMonthEntry;
        Assert.Same(vm.Cartera.Years[0].Months[1], entry);
        Assert.Equal((40000m, 900000m, 940000m, 3, 2), (entry.TotalServicios, entry.TotalArriendo, entry.Total, entry.ChargeCount, entry.ApartmentCount));
        Assert.Equal(12000m, entry.UpcomingTotal);
        Assert.False(vm.CurrentMonthIsEmpty);
        Assert.True(vm.CurrentMonthHasUpcoming);
    }

    [Fact]
    public async Task CurrentMonthEntry_ForAMonthWithNothingListed_IsAnEmptyOne()
    {
        var (vm, _) = await Build(now: new DateTime(2026, 6, 1));

        var entry = vm.CurrentMonthEntry;
        Assert.Equal((6, 2026), (entry.Month, entry.Year));
        Assert.Equal((0m, 0m, 0m, 0, 0), (entry.Total, entry.TotalServicios, entry.TotalArriendo, entry.ChargeCount, entry.ApartmentCount));
        Assert.True(vm.CurrentMonthIsEmpty);
        Assert.False(vm.CurrentMonthHasUpcoming);
    }

    [Fact]
    public async Task ACurrentMonthWithOnlyUpcomingCharges_IsNotOverdue_ButHasUpcomingFigures()
    {
        var (vm, _) = await Build(now: new DateTime(2026, 10, 2));

        Assert.True(vm.CurrentMonthIsEmpty);
        Assert.True(vm.CurrentMonthHasUpcoming);
        Assert.Equal(96000m, vm.CurrentMonthEntry.UpcomingTotal);
        Assert.Equal(0m, vm.CurrentMonthEntry.Total);
    }

    [Fact]
    public async Task CurrentMonthEntry_BeforeAnythingLoaded_IsEmpty()
    {
        var vm = new CarteraViewModel(new FakeAdminApiClient(), new FakeTokenStore(), new FakeCrashDiagnosticsService(), today: () => new DateTime(2026, 9, 20));

        Assert.True(vm.CurrentMonthIsEmpty);
        Assert.Equal(0m, vm.CurrentMonthEntry.Total);
        Assert.Null(vm.Anteriores);
    }

    // ---- the fixed range ----------------------------------------------------------------------

    [Fact]
    public async Task TimelineMonths_RunFromTheCurrentMonthBackThroughJanuaryOfLastYear_NewestFirst()
    {
        var (vm, _) = await Build();

        // Oct 2026 is a future month and 2024 is older: neither is a month row.
        Assert.Equal([(2026, 9), (2026, 8), (2025, 1)], Periods(vm.TimelineMonths));
    }

    [Fact]
    public async Task TimelineMonths_AlwaysIncludeTheCurrentMonth_EvenWithNoCharges()
    {
        var (vm, _) = await Build(now: new DateTime(2026, 6, 1));

        Assert.Equal([(2026, 6), (2025, 1)], Periods(vm.TimelineMonths));
        Assert.Empty(vm.TimelineMonths[0].Charges);
    }

    [Fact]
    public async Task TimelineMonths_ShowAFutureMonthOnceItBecomesTheCurrentOne()
    {
        var (vm, _) = await Build(now: new DateTime(2026, 10, 2));

        Assert.Equal([(2026, 10), (2026, 9), (2026, 8), (2025, 1)], Periods(vm.TimelineMonths));
    }

    [Fact]
    public async Task TimelineMonths_TheRangeMovesWithTheClock()
    {
        var (vm, _) = await Build(now: new DateTime(2027, 2, 1)); // range is now Jan 2026 .. Feb 2027

        Assert.Equal([(2027, 2), (2026, 10), (2026, 9), (2026, 8)], Periods(vm.TimelineMonths)); // Oct 2026 is no longer a future month
    }

    [Fact]
    public async Task TimelineMonths_DoesNotMutateTheLoadedCartera()
    {
        var (vm, _) = await Build(now: new DateTime(2026, 6, 1));

        _ = vm.TimelineMonths;
        _ = vm.Anteriores;

        Assert.Equal([2026, 2025, 2024], vm.Cartera.Years.Select(y => y.Year));
        Assert.Equal(3, vm.Cartera.Years[0].Months.Count);
    }

    // ---- "Anteriores" -------------------------------------------------------------------------

    [Fact]
    public async Task Anteriores_GathersTheOverdueDebtOlderThanJanuaryOfLastYear()
    {
        var (vm, _) = await Build();

        var old = vm.Anteriores;
        Assert.NotNull(old);
        Assert.Equal((5000m, 1450000m, 1455000m), (old.TotalServicios, old.TotalArriendo, old.Total));
        Assert.Equal((2, 1), (old.ChargeCount, old.ApartmentCount));
        Assert.Equal(2025, old.FromYear);
        Assert.Equal([(2024, 12, "Agua"), (2024, 3, "Arriendo")], old.Charges.Select(c => (c.Year, c.Month, c.Charge.Service)));
    }

    [Fact]
    public async Task Anteriores_IsNullWhenNothingIsOlderThanTheRange()
    {
        var model = Sample();
        model.Years.RemoveAll(y => y.Year == 2024);
        var (vm, _) = await Build(model);

        Assert.Null(vm.Anteriores);
    }

    [Fact]
    public async Task Anteriores_TheBoundaryMovesWithTheClock()
    {
        var (vm, _) = await Build(now: new DateTime(2027, 2, 1)); // Jan 2025 is now older than Jan 2026

        Assert.Equal(2026, vm.Anteriores!.FromYear);
        Assert.Contains(vm.Anteriores.Charges, c => (c.Year, c.Month) == (2025, 1));
        Assert.Equal(3, vm.Anteriores.ChargeCount); // Jan 2025, Dec 2024, Mar 2024
    }

    [Fact]
    public async Task Anteriores_NeverIncludesUpcomingCharges()
    {
        var model = Sample();
        model.Years.First(y => y.Year == 2024).Months[0].UpcomingCharges = [Upcoming(3, "Gas", 999m, 4)];
        var (vm, _) = await Build(model);

        Assert.All(vm.Anteriores!.Charges, c => Assert.Null(c.Charge.DaysUntilDue));
        Assert.Equal(2, vm.Anteriores.ChargeCount);
    }

    // ---- notify covers the current month's overdue charges only -------------------------------

    [Fact]
    public async Task CanNotifyAll_LooksOnlyAtTheCurrentMonthsOverdueApartments()
    {
        var (vm, _) = await Build();
        Assert.True(vm.CanNotifyAll);              // Sep: 101 is reachable

        var (quiet, _) = await Build(now: new DateTime(2026, 6, 1)); // nothing overdue in June
        Assert.False(quiet.CanNotifyAll);
    }

    [Fact]
    public async Task CanNotifyAll_IgnoresUpcomingChargesAndApartmentsOnlyInOtherMonths()
    {
        var (vm, _) = await Build(now: new DateTime(2026, 10, 2)); // Oct has por vencer only

        Assert.False(vm.CanNotifyAll);
    }

    [Fact]
    public async Task BuildBulkConfirmation_NamesTheCurrentMonth_AndCountsOnlyItsApartments()
    {
        var (vm, _) = await Build();

        Assert.Equal(
            "Se notificará a 1 apartamento con cartera vencida de septiembre 2026.\n" +
            "1 apartamento no se puede notificar (sin arrendar o sin propietario activo).",
            vm.BuildBulkConfirmation());
    }

    [Fact]
    public async Task BuildApartmentConfirmation_StatesTheCurrentMonthsCountAndTotal()
    {
        var (vm, _) = await Build();

        Assert.Equal(
            "Se enviará a Carlos el detalle de su cartera vencida de septiembre 2026: 2 conceptos por $940.000.",
            vm.BuildApartmentConfirmation(1));
    }

    [Fact]
    public async Task Notify_SendsTheCurrentMonthAndYear()
    {
        var (vm, api) = await Build();

        await vm.NotifyAllAsync();
        Assert.Null(api.LastNotificarApartmentId);
        Assert.Equal((9, 2026), (api.LastNotificarMonth, api.LastNotificarYear));

        await vm.NotifyApartmentAsync(1);
        Assert.Equal(1L, api.LastNotificarApartmentId);
        Assert.Equal((9, 2026), (api.LastNotificarMonth, api.LastNotificarYear));
    }

    [Fact]
    public async Task IsEmpty_IsFalseWhenOnlyUpcomingMonthsExist()
    {
        var model = new CarteraModel
        {
            Years = [new CarteraYearModel { Year = 2026, Months = [Month(2026, 10, [], Upcoming(1, "Agua", 96000m, 8))] }],
        };
        var (vm, _) = await Build(model);

        Assert.False(vm.IsEmpty);
    }
}
