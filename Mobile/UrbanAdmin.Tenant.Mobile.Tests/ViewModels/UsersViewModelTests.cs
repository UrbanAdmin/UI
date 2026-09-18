using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class UsersViewModelTests
{
    [Fact]
    public async Task LoadAsync_PopulatesItemsFromTheApi()
    {
        var apiClient = new FakeAdminApiClient
        {
            Users = [new UserModel { Id = 1, Username = "ana", Role = "ApartmentOwner", ApartmentId = 1 }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new UsersViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.Single(vm.Items);
        Assert.Equal("ana", vm.Items[0].Username);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_AlsoLoadsApartmentsForTheDisplayJoin()
    {
        var apiClient = new FakeAdminApiClient
        {
            Users = [new UserModel { Id = 1, Username = "ana", Role = "ApartmentOwner", ApartmentId = 1 }],
            Apartments = [new ApartmentModel { Id = 1, Name = "101", Status = "Arrendado" }],
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new UsersViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.Single(vm.Apartments);
        Assert.Equal("101", vm.Apartments[0].Name);
    }

    [Fact]
    public async Task LoadAsync_ReportsEmptyWhenListIsEmpty()
    {
        var apiClient = new FakeAdminApiClient { Users = [] };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new UsersViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService());

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var apiClient = new FakeAdminApiClient { ThrowOnGetUsers = true };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new UsersViewModel(apiClient, tokenStore, diagnostics);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal([("users", (int?)null)], diagnostics.ApiErrors);
    }
}
