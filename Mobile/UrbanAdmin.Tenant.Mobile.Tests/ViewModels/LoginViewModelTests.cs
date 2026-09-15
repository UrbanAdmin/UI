using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class LoginViewModelTests
{
    [Fact]
    public async Task LoginAsync_SavesTheTokenOnSuccess()
    {
        var apiClient = new FakeTenantApiClient { TokenToReturn = "fake-jwt" };
        var tokenStore = new FakeTokenStore();
        var vm = new LoginViewModel(apiClient, tokenStore) { Username = "owner101", Password = "pw" };

        var success = await vm.LoginAsync();

        Assert.True(success);
        Assert.Equal("fake-jwt", await tokenStore.GetTokenAsync());
        Assert.Null(vm.ErrorMessage);
    }

    [Fact]
    public async Task LoginAsync_SetsAnErrorMessageOnInvalidCredentials()
    {
        var apiClient = new FakeTenantApiClient { TokenToReturn = null };
        var tokenStore = new FakeTokenStore();
        var vm = new LoginViewModel(apiClient, tokenStore) { Username = "owner101", Password = "wrong" };

        var success = await vm.LoginAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
        Assert.Null(await tokenStore.GetTokenAsync());
    }
}
