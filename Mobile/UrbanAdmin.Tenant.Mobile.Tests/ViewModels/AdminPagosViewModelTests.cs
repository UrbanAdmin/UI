using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class AdminPagosViewModelTests
{
    [Fact]
    public async Task LoadAsync_PopulatesItemsFromTheApi()
    {
        var apiClient = new FakeAdminApiClient
        {
            AdminPagos = [new AdminPagoRowModel { ApartmentId = 1, ApartmentNumber = "101", Utility = "Agua" }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.Single(vm.Items);
        Assert.Equal("101", vm.Items[0].ApartmentNumber);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_DefaultsMonthAndYearToToday()
    {
        var apiClient = new FakeAdminApiClient();
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        var today = DateTime.Now;
        Assert.Equal((null, (int?)today.Month, (int?)today.Year, (string?)null), apiClient.LastGetAdminPagosArgs);
        Assert.Equal(today.Month, vm.Month);
        Assert.Equal(today.Year, vm.Year);
    }

    [Fact]
    public async Task LoadAsync_UsesTheSelectedMonthAndYear()
    {
        var apiClient = new FakeAdminApiClient();
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService())
        {
            Month = 1,
            Year = 2026,
        };

        await vm.LoadAsync();

        Assert.Equal(((long?)null, (int?)1, (int?)2026, (string?)null), apiClient.LastGetAdminPagosArgs);
    }

    [Fact]
    public async Task LoadAsync_ReportsEmptyWhenListIsEmpty()
    {
        var apiClient = new FakeAdminApiClient { AdminPagos = [] };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeAdminApiClient { ThrowOnGetAdminPagos = true };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new AdminPagosViewModel(apiClient, tokenStore, diagnostics);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal([("admin-pagos", (int?)null)], diagnostics.ApiErrors);
    }

    [Fact]
    public void SumNonArriendoAmounts_ExcludesArriendoAndTreatsUnparseableAmountsAsZero()
    {
        var rows = new List<AdminPagoRowModel>
        {
            new() { Utility = "Agua", Amount = "10000" },
            new() { Utility = "Arriendo", Amount = "999999" },
            new() { Utility = "Luz", Amount = "not-a-number" },
            new() { Utility = "Gas", Amount = null },
        };

        var total = AdminPagosViewModel.SumNonArriendoAmounts(rows);

        Assert.Equal(10000m, total);
    }

    // 014-admin-pagos-first-tab FR-010: the Pagos tab always opens on the current month.
    [Fact]
    public void ResetToCurrentPeriod_SetsMonthAndYearFromTheGivenDate()
    {
        var vm = NewViewModel();
        vm.Month = 1;
        vm.Year = 2024;

        vm.ResetToCurrentPeriod(new DateTime(2026, 9, 20));

        Assert.Equal(9, vm.Month);
        Assert.Equal(2026, vm.Year);
    }

    [Fact]
    public void ResetToCurrentPeriod_FollowsTheCalendarAcrossTheYearBoundary()
    {
        var vm = NewViewModel();

        vm.ResetToCurrentPeriod(new DateTime(2027, 1, 1));

        Assert.Equal(1, vm.Month);
        Assert.Equal(2027, vm.Year);
    }

    [Fact]
    public async Task ResetToCurrentPeriod_KeepsTheLoadedItemsUntilTheNextLoad()
    {
        var apiClient = new FakeAdminApiClient
        {
            AdminPagos = [new AdminPagoRowModel { ApartmentId = 1, ApartmentNumber = "101", Utility = "Agua" }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());
        await vm.LoadAsync();

        vm.ResetToCurrentPeriod(new DateTime(2026, 9, 20));

        Assert.Single(vm.Items);
    }

    private static AdminPagosViewModel NewViewModel() =>
        new(new FakeAdminApiClient(), new FakeTokenStore(), new FakeCrashDiagnosticsService());
}
