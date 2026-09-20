using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 012-cartera-vencida-timeline, post-build round (FR-020, SC-009): the Cartera screen works on ONE
// selected month/year (default: the current month). The hero and the notify actions follow it; the
// timeline of all periods stays. Selecting a period never calls the API again.
public class CarteraViewModelPeriodTests
{
    private static CarteraChargeModel Charge(long apartment, string service, decimal? amount, bool rent = false) =>
        new() { ApartmentId = apartment, ApartmentNumber = apartment.ToString(), Service = service, Amount = amount, IsRent = rent };

    private static CarteraChargeModel Upcoming(long apartment, string service, decimal? amount, int daysLeft, bool rent = false) =>
        new() { ApartmentId = apartment, ApartmentNumber = apartment.ToString(), Service = service, Amount = amount, IsRent = rent, DaysUntilDue = daysLeft };

    private static CarteraMonthModel WithUpcoming(CarteraMonthModel month, params CarteraChargeModel[] upcoming)
    {
        month.UpcomingCharges = upcoming.ToList();
        month.UpcomingServicios = upcoming.Where(c => !c.IsRent).Sum(c => c.Amount ?? 0);
        month.UpcomingArriendo = upcoming.Where(c => c.IsRent).Sum(c => c.Amount ?? 0);
        month.UpcomingTotal = month.UpcomingServicios + month.UpcomingArriendo;
        month.UpcomingChargeCount = upcoming.Length;
        return month;
    }

    private static CarteraMonthModel Month(int year, int month, params CarteraChargeModel[] charges) => new()
    {
        Year = year,
        Month = month,
        Charges = charges.ToList(),
        TotalServicios = charges.Where(c => !c.IsRent).Sum(c => c.Amount ?? 0),
        TotalArriendo = charges.Where(c => c.IsRent).Sum(c => c.Amount ?? 0),
        Total = charges.Sum(c => c.Amount ?? 0),
        ChargeCount = charges.Length,
        ApartmentCount = charges.Select(c => c.ApartmentId).Distinct().Count(),
    };

    // Sep 2026: 101 (Agua 40.000 + Arriendo 900.000), 202 (Luz sin monto). Aug 2026: 101 (Agua 30.000).
    // Dec 2024: 303 (Agua 5.000) - an older year than the default window.
    private static CarteraModel Sample() => new()
    {
        Years =
        [
            new CarteraYearModel { Year = 2026, Months = [Month(2026, 9, Charge(1, "Agua", 40000m), Charge(1, "Arriendo", 900000m, rent: true), Charge(2, "Luz", null)), Month(2026, 8, Charge(1, "Agua", 30000m))] },
            new CarteraYearModel { Year = 2024, Months = [Month(2024, 12, Charge(3, "Agua", 5000m))] },
        ],
        Apartments =
        [
            new CarteraApartmentModel { ApartmentId = 1, ApartmentNumber = "101", Owner = "Carlos", ChargeCount = 3, Total = 970000m, CanNotify = true },
            new CarteraApartmentModel { ApartmentId = 2, ApartmentNumber = "202", Owner = "Yesenia", ChargeCount = 1, CanNotify = false, CannotNotifyReason = "Sin propietario activo" },
            new CarteraApartmentModel { ApartmentId = 3, ApartmentNumber = "303", Owner = "Luis", ChargeCount = 1, Total = 5000m, CanNotify = true, NotifiedToday = true, LastNotifiedAt = new DateTime(2026, 9, 20, 14, 5, 0, DateTimeKind.Utc) },
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

    // ---- T060: selected period ---------------------------------------------------------------

    [Fact]
    public async Task Period_DefaultsToTheCurrentMonthAndYear()
    {
        var (vm, _) = await Build(now: new DateTime(2026, 9, 20));

        Assert.Equal((9, 2026), (vm.SelectedMonth, vm.SelectedYear));
    }

    [Fact]
    public async Task SelectPeriod_ChangesTheSelectionWithoutCallingTheApi()
    {
        var (vm, api) = await Build();
        var loads = api.GetCarteraCallCount;

        vm.SelectPeriod(12, 2024);

        Assert.Equal((12, 2024), (vm.SelectedMonth, vm.SelectedYear));
        Assert.Equal(loads, api.GetCarteraCallCount);
    }

    [Fact]
    public async Task AvailableYears_IsTheWindowPlusEveryDataYear_Ascending()
    {
        var (vm, _) = await Build();

        Assert.Equal([2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031], vm.AvailableYears);
    }

    [Fact]
    public async Task SelectedMonthEntry_IsTheMatchingMonthOfTheTimeline()
    {
        var (vm, _) = await Build();

        Assert.Same(vm.Cartera.Years[0].Months[0], vm.SelectedMonthEntry);

        vm.SelectPeriod(8, 2026);
        Assert.Same(vm.Cartera.Years[0].Months[1], vm.SelectedMonthEntry);
    }

    [Fact]
    public async Task SelectedMonthEntry_ForAMonthWithNothingOverdue_IsASynthesizedEmptyOne()
    {
        var (vm, _) = await Build();

        vm.SelectPeriod(3, 2027);

        var entry = vm.SelectedMonthEntry;
        Assert.Equal((3, 2027), (entry.Month, entry.Year));
        Assert.Empty(entry.Charges);
        Assert.Equal((0m, 0m, 0m, 0, 0), (entry.Total, entry.TotalServicios, entry.TotalArriendo, entry.ChargeCount, entry.ApartmentCount));
        Assert.True(vm.SelectedMonthIsEmpty);
    }

    [Fact]
    public async Task HeroFigures_AreTheSelectedMonthsSubtotal_NotTheBuildingTotal()
    {
        var (vm, _) = await Build();

        // Default = September 2026: 40.000 servicios + 900.000 arriendo, 3 charges in 2 apartments.
        var entry = vm.SelectedMonthEntry;
        Assert.Equal((40000m, 900000m, 940000m, 3, 2), (entry.TotalServicios, entry.TotalArriendo, entry.Total, entry.ChargeCount, entry.ApartmentCount));
        Assert.False(vm.SelectedMonthIsEmpty);

        vm.SelectPeriod(12, 2024);
        Assert.Equal((5000m, 0m, 5000m, 1, 1), (vm.SelectedMonthEntry.TotalServicios, vm.SelectedMonthEntry.TotalArriendo, vm.SelectedMonthEntry.Total, vm.SelectedMonthEntry.ChargeCount, vm.SelectedMonthEntry.ApartmentCount));
    }

    [Fact]
    public async Task SelectedMonthEntry_BeforeAnythingLoaded_IsEmptyForTheDefaultPeriod()
    {
        var api = new FakeAdminApiClient();
        var vm = new CarteraViewModel(api, new FakeTokenStore(), new FakeCrashDiagnosticsService(), today: () => new DateTime(2026, 9, 20));

        Assert.True(vm.SelectedMonthIsEmpty);
        Assert.Equal(0m, vm.SelectedMonthEntry.Total);
        await Task.CompletedTask;
    }

    // ---- T062: notify scoped to the selected month --------------------------------------------

    [Fact]
    public async Task CanNotifyAll_LooksOnlyAtApartmentsOverdueInTheSelectedMonth()
    {
        var (vm, _) = await Build();

        Assert.True(vm.CanNotifyAll);        // Sep: 101 is reachable

        vm.SelectPeriod(3, 2027);            // nothing overdue
        Assert.False(vm.CanNotifyAll);
    }

    [Fact]
    public async Task CanNotifyAll_IsFalseWhenOnlyUnreachableApartmentsAreOverdueThatMonth()
    {
        var model = Sample();
        model.Years = [new CarteraYearModel { Year = 2026, Months = [Month(2026, 9, Charge(2, "Luz", 1000m))] }];
        var (vm, _) = await Build(model);

        Assert.False(vm.CanNotifyAll);
    }

    [Fact]
    public async Task BuildBulkConfirmation_CountsOnlyTheSelectedMonthsApartments_AndNamesTheMonth()
    {
        var (vm, _) = await Build();

        Assert.Equal(
            "Se notificará a 1 apartamento con cartera vencida de septiembre 2026.\n" +
            "1 apartamento no se puede notificar (sin arrendar o sin propietario activo).",
            vm.BuildBulkConfirmation());
    }

    [Fact]
    public async Task BuildBulkConfirmation_KeepsAlreadyNotifiedTodayPerApartment()
    {
        var (vm, _) = await Build();

        vm.SelectPeriod(12, 2024); // apartment 303 - already notified today

        Assert.Equal(
            "Se notificará a 1 apartamento con cartera vencida de diciembre 2024.\n" +
            "1 ya recibió una notificación hoy. Puedes enviarla de nuevo.",
            vm.BuildBulkConfirmation());
    }

    [Fact]
    public async Task BuildApartmentConfirmation_StatesThatMonthsCountAndTotal_NotTheWholeBalance()
    {
        var (vm, _) = await Build();

        // 101 owes 970.000 overall, but in September only Agua 40.000 + Arriendo 900.000 = 940.000.
        Assert.Equal(
            "Se enviará a Carlos el detalle de su cartera vencida de septiembre 2026: 2 conceptos por $940.000.",
            vm.BuildApartmentConfirmation(1));

        vm.SelectPeriod(8, 2026);
        Assert.Equal(
            "Se enviará a Carlos el detalle de su cartera vencida de agosto 2026: 1 concepto por $30.000.",
            vm.BuildApartmentConfirmation(1));
    }

    [Fact]
    public async Task BuildApartmentConfirmation_WarnsAboutAnEarlierSendToday()
    {
        var (vm, _) = await Build();
        vm.SelectPeriod(12, 2024);

        Assert.Equal(
            "Se enviará a Luis el detalle de su cartera vencida de diciembre 2024: 1 concepto por $5.000.\n" +
            "Ya se notificó hoy a las 09:05. Puedes enviarla de nuevo.",
            vm.BuildApartmentConfirmation(3));
    }

    [Fact]
    public async Task NotifyAllAsync_SendsTheSelectedMonthAndYear()
    {
        var (vm, api) = await Build();
        vm.SelectPeriod(8, 2026);

        await vm.NotifyAllAsync();

        Assert.Null(api.LastNotificarApartmentId);
        Assert.Equal((8, 2026), (api.LastNotificarMonth, api.LastNotificarYear));
    }

    [Fact]
    public async Task NotifyApartmentAsync_SendsTheApartmentWithTheSelectedMonthAndYear()
    {
        var (vm, api) = await Build();

        await vm.NotifyApartmentAsync(1);

        Assert.Equal(1L, api.LastNotificarApartmentId);
        Assert.Equal((9, 2026), (api.LastNotificarMonth, api.LastNotificarYear));
    }

    [Fact]
    public async Task Notify_KeepsTheSelectedPeriodAfterTheReload()
    {
        var (vm, _) = await Build();
        vm.SelectPeriod(8, 2026);

        await vm.NotifyAllAsync();

        Assert.Equal((8, 2026), (vm.SelectedMonth, vm.SelectedYear));
    }

    // ---- flat timeline: months only, real periods + the selected one --------------------------

    [Fact]
    public async Task TimelineMonths_IsAFlatListOfEveryMonthNewestFirst()
    {
        var (vm, _) = await Build();

        Assert.Equal([(2026, 9), (2026, 8), (2024, 12)], vm.TimelineMonths.Select(m => (m.Year, m.Month)));
        Assert.Same(vm.Cartera.Years[0].Months[0], vm.TimelineMonths[0]);
    }

    [Fact]
    public async Task TimelineMonths_AddAnEmptyEntryForTheSelectedMonth_InChronologicalPlace()
    {
        var (vm, _) = await Build();

        vm.SelectPeriod(10, 2026); // nothing in Oct 2026
        Assert.Equal([(2026, 10), (2026, 9), (2026, 8), (2024, 12)], vm.TimelineMonths.Select(m => (m.Year, m.Month)));
        Assert.Empty(vm.TimelineMonths[0].Charges);

        vm.SelectPeriod(3, 2027);
        Assert.Equal((2027, 3), (vm.TimelineMonths[0].Year, vm.TimelineMonths[0].Month));

        vm.SelectPeriod(1, 2025);
        Assert.Equal([(2026, 9), (2026, 8), (2025, 1), (2024, 12)], vm.TimelineMonths.Select(m => (m.Year, m.Month)));
    }

    [Fact]
    public async Task TimelineMonths_DoesNotMutateTheLoadedCartera()
    {
        var (vm, _) = await Build();

        vm.SelectPeriod(3, 2027);
        _ = vm.TimelineMonths;

        Assert.Equal([2026, 2024], vm.Cartera.Years.Select(y => y.Year));
        Assert.Equal(2, vm.Cartera.Years[0].Months.Count);
    }

    // ---- "por vencer" (FR-021) ----------------------------------------------------------------

    private static CarteraModel WithUpcomingOnlyOctober()
    {
        var model = Sample();
        model.Years[0].Months.Insert(0, WithUpcoming(Month(2026, 10), Upcoming(1, "Agua", 96000m, 8), Upcoming(2, "Luz", null, 0)));
        // September also has a por-vencer charge next to its overdue ones.
        WithUpcoming(model.Years[0].Months[1], Upcoming(1, "Gas", 12000m, 3));
        return model;
    }

    [Fact]
    public async Task AMonthWithOnlyUpcomingCharges_IsNotOverdue_ButHasUpcomingFigures()
    {
        var (vm, _) = await Build(WithUpcomingOnlyOctober());
        vm.SelectPeriod(10, 2026);

        Assert.True(vm.SelectedMonthIsEmpty);                       // nothing overdue
        Assert.True(vm.SelectedMonthHasUpcoming);
        Assert.Equal(0m, vm.SelectedMonthEntry.Total);
        Assert.Equal((96000m, 0m, 96000m, 2), (vm.SelectedMonthEntry.UpcomingServicios, vm.SelectedMonthEntry.UpcomingArriendo, vm.SelectedMonthEntry.UpcomingTotal, vm.SelectedMonthEntry.UpcomingChargeCount));
    }

    [Fact]
    public async Task OverdueAndUpcomingFiguresOfAMonthStaySeparate()
    {
        var (vm, _) = await Build(WithUpcomingOnlyOctober());

        var sep = vm.SelectedMonthEntry;
        Assert.Equal(940000m, sep.Total);            // overdue only
        Assert.Equal(12000m, sep.UpcomingTotal);     // por vencer beside it, never added in
        Assert.False(vm.SelectedMonthIsEmpty);
        Assert.True(vm.SelectedMonthHasUpcoming);
    }

    [Fact]
    public async Task AMonthWithNoChargesAtAll_HasNoUpcoming()
    {
        var (vm, _) = await Build();
        vm.SelectPeriod(3, 2027);

        Assert.True(vm.SelectedMonthIsEmpty);
        Assert.False(vm.SelectedMonthHasUpcoming);
    }

    [Fact]
    public async Task CanNotifyAll_IgnoresUpcomingCharges()
    {
        var (vm, _) = await Build(WithUpcomingOnlyOctober());
        vm.SelectPeriod(10, 2026); // apartment 1 is reachable but has only a por-vencer charge

        Assert.False(vm.CanNotifyAll);
    }

    [Fact]
    public async Task IsEmpty_IsFalseWhenOnlyUpcomingMonthsExist()
    {
        var model = new CarteraModel
        {
            Years = [new CarteraYearModel { Year = 2026, Months = [WithUpcoming(Month(2026, 10), Upcoming(1, "Agua", 96000m, 8))] }],
        };
        var (vm, _) = await Build(model);

        Assert.False(vm.IsEmpty);
    }
}
