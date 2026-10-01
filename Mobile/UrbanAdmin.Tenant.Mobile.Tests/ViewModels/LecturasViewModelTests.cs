using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 029-tenant-mobile-lecturas: the tenant's own Gas/Agua readings statement, mirroring
// PagosViewModel's existing shape and error-handling convention exactly.
public class LecturasViewModelTests
{
    private static async Task<FakeTokenStore> TokenAsync()
    {
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        return tokenStore;
    }

    [Fact]
    public async Task LoadAsync_LoadsTheHeaderKickerFromPerfilOnce()
    {
        var apiClient = new FakeTenantApiClient { Perfil = new PerfilModel { ApartmentNumber = "304", OwnerName = "María Fernández" } };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService()) { SelectedService = "Gas" };

        await vm.LoadAsync();
        await vm.LoadAsync();

        Assert.Equal("APTO 304 · MARÍA FERNÁNDEZ", vm.HeaderKicker);
        Assert.Equal(1, apiClient.GetPerfilCallCount);
    }

    [Fact]
    public async Task LoadAsync_Gas_LoadsTheStatementForTheSelectedMonthAndYear()
    {
        var apiClient = new FakeTenantApiClient
        {
            Lecturas = new LecturasModel
            {
                State = "ready", Unit = "m³", PreviousReading = "0", CurrentReading = "30",
                Consumption = "30", Percentage = "1", Total = "300",
                Breakdown = [new LecturasBreakdownLineModel { Label = "Costo variable", Value = "300" }],
            },
        };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService())
        {
            SelectedService = "Gas",
            Month = 9,
            Year = 2026,
        };

        await vm.LoadAsync();

        Assert.Equal(("Gas", (int?)9, (int?)2026, (long?)null), apiClient.LastGetLecturasArgs);
        Assert.Equal("ready", vm.Statement?.State);
        Assert.Equal("Septiembre 2026", vm.PeriodLabel);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_Agua_LoadsPeriodsFirstThenAutoSelectsTheOneMatchingTheCurrentMonth()
    {
        var today = new DateTime(2026, 9, 20);
        var older = new LecturasPeriodoModel { Id = 1, StartDate = new DateTime(2026, 7, 10), EndDate = new DateTime(2026, 9, 9), Confirmed = true };
        var current = new LecturasPeriodoModel { Id = 2, StartDate = new DateTime(2026, 9, 10), EndDate = new DateTime(2026, 10, 7), Confirmed = true };
        var apiClient = new FakeTenantApiClient
        {
            LecturasPeriodos = [current, older], // newest-first, like the real /WaterBills ordering
            Lecturas = new LecturasModel { State = "ready", Total = "351700" },
        };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService(), () => today)
        {
            SelectedService = "Agua",
        };

        await vm.LoadAsync();

        Assert.Equal(2, vm.SelectedPeriodId);
        Assert.Equal(("Agua", (int?)null, (int?)null, (long?)2), apiClient.LastGetLecturasArgs);
        Assert.Equal("10 de septiembre de 2026 - 7 de octubre de 2026", vm.PeriodLabel);
    }

    [Fact]
    public async Task LoadAsync_Agua_SortsPeriodsNewestFirstRegardlessOfApiOrder()
    {
        // GET /WaterBills itself returns oldest-first (ListWaterBillPeriodsHandler orders by
        // StartDate ascending) - the ViewModel, not the API, is responsible for newest-first display,
        // mirroring payments.component.ts's own client-side sort from 027.
        var older = new LecturasPeriodoModel { Id = 1, StartDate = new DateTime(2026, 7, 10), EndDate = new DateTime(2026, 9, 9), Confirmed = true };
        var newer = new LecturasPeriodoModel { Id = 2, StartDate = new DateTime(2026, 9, 10), EndDate = new DateTime(2026, 10, 7), Confirmed = true };
        var apiClient = new FakeTenantApiClient { LecturasPeriodos = [older, newer] }; // oldest-first, as the real endpoint returns
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService()) { SelectedService = "Agua" };

        await vm.LoadAsync();

        Assert.Equal([2, 1], vm.Periods.Select(p => p.Id));
    }

    [Fact]
    public async Task LoadAsync_Agua_FallsBackToTheNewestPeriodWhenNoneMatchesTheCurrentMonth()
    {
        var today = new DateTime(2026, 11, 1); // after every known period
        var older = new LecturasPeriodoModel { Id = 1, StartDate = new DateTime(2026, 7, 10), EndDate = new DateTime(2026, 9, 9), Confirmed = true };
        var newest = new LecturasPeriodoModel { Id = 2, StartDate = new DateTime(2026, 9, 10), EndDate = new DateTime(2026, 10, 7), Confirmed = true };
        var apiClient = new FakeTenantApiClient
        {
            LecturasPeriodos = [newest, older],
            Lecturas = new LecturasModel { State = "ready", Total = "100" },
        };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService(), () => today)
        {
            SelectedService = "Agua",
        };

        await vm.LoadAsync();

        Assert.Equal(2, vm.SelectedPeriodId);
    }

    [Fact]
    public async Task LoadAsync_Agua_IsEmptyWhenThereAreNoPeriodsAtAll()
    {
        var apiClient = new FakeTenantApiClient { LecturasPeriodos = [] };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService())
        {
            SelectedService = "Agua",
        };

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
        Assert.Null(vm.SelectedPeriodId);
    }

    [Fact]
    public async Task LoadAsync_IsEmptyWhenTheStatementStateIsEmpty()
    {
        var apiClient = new FakeTenantApiClient { Lecturas = new LecturasModel { State = "empty" } };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService()) { SelectedService = "Gas" };

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_SetsAGenericErrorMessageOnAFailure()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnGet = true };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService()) { SelectedService = "Gas" };

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("No se pudo cargar tu información de lecturas. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
    }

    [Fact]
    public async Task LoadAsync_SetsADeactivatedAccountMessageOnA403()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnGet = true, ThrowStatusCode = System.Net.HttpStatusCode.Forbidden };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService()) { SelectedService = "Gas" };

        await vm.LoadAsync();

        Assert.Equal("Tu cuenta fue desactivada. Contacta a tu administrador.", vm.ErrorMessage);
    }

    [Fact]
    public async Task LoadAsync_SwitchingServiceReloadsTheStatementForTheNewService()
    {
        var apiClient = new FakeTenantApiClient
        {
            LecturasPeriodos = [new LecturasPeriodoModel { Id = 3, StartDate = DateTime.Now, EndDate = DateTime.Now.AddDays(20), Confirmed = true }],
            Lecturas = new LecturasModel { State = "ready", Total = "100" },
        };
        var vm = new LecturasViewModel(apiClient, await TokenAsync(), new FakeCrashDiagnosticsService()) { SelectedService = "Gas" };
        await vm.LoadAsync();
        Assert.Equal("Gas", apiClient.LastGetLecturasArgs?.Servicio);

        vm.SelectedService = "Agua";
        await vm.LoadAsync();

        Assert.Equal("Agua", apiClient.LastGetLecturasArgs?.Servicio);
        Assert.Equal(3, vm.SelectedPeriodId);
    }
}
