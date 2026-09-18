using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class ApartmentsViewModelTests
{
    [Fact]
    public async Task LoadAsync_PopulatesItemsFromTheApi()
    {
        var apiClient = new FakeAdminApiClient
        {
            Apartments = [new ApartmentModel { Id = 1, Name = "101", Owner = "Ana", Status = "Arrendado" }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new ApartmentsViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.Single(vm.Items);
        Assert.Equal("101", vm.Items[0].Name);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_ReportsEmptyWhenListIsEmpty()
    {
        var apiClient = new FakeAdminApiClient { Apartments = [] };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new ApartmentsViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeAdminApiClient { ThrowOnGetApartments = true };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new ApartmentsViewModel(apiClient, tokenStore, diagnostics);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal([("apartments", (int?)null)], diagnostics.ApiErrors);
    }
}
