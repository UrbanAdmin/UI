using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class NotificacionesViewModelTests
{
    [Fact]
    public async Task LoadAsync_PopulatesItemsFromTheApi()
    {
        var apiClient = new FakeTenantApiClient
        {
            Notificaciones = [new NotificacionModel { Utility = "Arriendo", Status = "due-soon" }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var vm = new NotificacionesViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.False(vm.IsBusy);
        Assert.False(vm.HasError);
        Assert.Single(vm.Items);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_ReportsEmptyStateForAnApartmentWithNoReminders()
    {
        var apiClient = new FakeTenantApiClient { Notificaciones = [] };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var vm = new NotificacionesViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
        Assert.False(vm.HasError);
    }

    [Fact]
    public async Task LoadAsync_SetsHasErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnGet = true };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var vm = new NotificacionesViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.False(vm.IsEmpty);
    }

    // US2 (FR-005): a non-crashing API failure is still recorded as a diagnostic event.
    [Fact]
    public async Task LoadAsync_LogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnGet = true };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new NotificacionesViewModel(apiClient, tokenStore, diagnostics);

        await vm.LoadAsync();

        Assert.Equal([("notificaciones", (int?)null)], diagnostics.ApiErrors);
    }
}
