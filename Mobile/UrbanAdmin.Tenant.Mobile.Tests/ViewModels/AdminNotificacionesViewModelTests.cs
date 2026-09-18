using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class AdminNotificacionesViewModelTests
{
    [Fact]
    public async Task LoadAsync_PopulatesItemsFromTheApi()
    {
        var apiClient = new FakeAdminApiClient
        {
            AdminNotificaciones = [new AdminNotificationRowModel { ApartmentId = 1, ApartmentNumber = "101", Service = "Agua", Status = "overdue" }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminNotificacionesViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.Single(vm.Items);
        Assert.Equal("overdue", vm.Items[0].Status);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_ReportsEmptyWhenListIsEmpty()
    {
        var apiClient = new FakeAdminApiClient { AdminNotificaciones = [] };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminNotificacionesViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeAdminApiClient { ThrowOnGetAdminNotificaciones = true };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new AdminNotificacionesViewModel(apiClient, tokenStore, diagnostics);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal([("admin-notificaciones", (int?)null)], diagnostics.ApiErrors);
    }
}
