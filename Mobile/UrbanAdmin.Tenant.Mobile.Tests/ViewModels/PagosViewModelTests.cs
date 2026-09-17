using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class PagosViewModelTests
{
    [Fact]
    public async Task LoadAsync_PopulatesItemsFromTheApi()
    {
        var apiClient = new FakeTenantApiClient
        {
            Pagos = [new PagoModel { Utility = "Arriendo", Amount = "750000", Paid = false }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var vm = new PagosViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.Single(vm.Items);
        Assert.False(vm.Items[0].Paid);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_ReportsNothingDueWhenListIsEmpty()
    {
        var apiClient = new FakeTenantApiClient { Pagos = [] };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var vm = new PagosViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
    }

    // US2 (FR-005): a non-crashing API failure is still recorded as a diagnostic event.
    [Fact]
    public async Task LoadAsync_LogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnGet = true };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new PagosViewModel(apiClient, tokenStore, diagnostics);

        await vm.LoadAsync();

        Assert.Equal([("pagos", (int?)null)], diagnostics.ApiErrors);
    }
}
