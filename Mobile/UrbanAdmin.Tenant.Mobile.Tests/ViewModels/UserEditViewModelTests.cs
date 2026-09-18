using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class UserEditViewModelTests
{
    private static async Task<(FakeAdminApiClient ApiClient, UserEditViewModel Vm)> MakeAsync(long? userId = null)
    {
        var apiClient = new FakeAdminApiClient();
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new UserEditViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService())
        {
            UserId = userId,
            Username = "ana",
            Password = "secret123",
            Role = "ApartmentOwner",
            ApartmentId = 1,
        };
        return (apiClient, vm);
    }

    [Fact]
    public async Task SaveAsync_CreatesANewUserWhenUserIdIsNull()
    {
        var (apiClient, vm) = await MakeAsync();

        var success = await vm.SaveAsync();

        Assert.True(success);
        Assert.Equal(("ana", "secret123", "ApartmentOwner", (long?)1), apiClient.LastCreatedUser);
        Assert.Null(apiClient.LastUpdatedUser);
    }

    [Fact]
    public async Task SaveAsync_UpdatesTheExistingUserWhenUserIdIsSet()
    {
        var (apiClient, vm) = await MakeAsync(userId: 7);
        vm.NewPassword = "newpass";

        var success = await vm.SaveAsync();

        Assert.True(success);
        Assert.Equal((7L, "ApartmentOwner", (long?)1, "newpass"), apiClient.LastUpdatedUser);
        Assert.Null(apiClient.LastCreatedUser);
    }

    [Fact]
    public async Task SaveAsync_TreatsBlankNewPasswordAsNoChange()
    {
        var (apiClient, vm) = await MakeAsync(userId: 7);
        vm.NewPassword = "   ";

        await vm.SaveAsync();

        Assert.Equal((7L, "ApartmentOwner", (long?)1, (string?)null), apiClient.LastUpdatedUser);
    }

    [Fact]
    public async Task SaveAsync_ClearsApartmentIdWhenRoleIsAdmin()
    {
        var (apiClient, vm) = await MakeAsync();
        vm.Role = "Admin";
        vm.ApartmentId = 1;

        var success = await vm.SaveAsync();

        Assert.True(success);
        Assert.Equal(("ana", "secret123", "Admin", (long?)null), apiClient.LastCreatedUser);
    }

    [Fact]
    public async Task SaveAsync_FailsValidationWhenApartmentOwnerHasNoApartment()
    {
        var (apiClient, vm) = await MakeAsync();
        vm.ApartmentId = null;

        var success = await vm.SaveAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
        Assert.Null(apiClient.LastCreatedUser);
    }

    [Fact]
    public async Task SaveAsync_FailsValidationWhenCreatingWithoutUsernameOrPassword()
    {
        var (apiClient, vm) = await MakeAsync();
        vm.Username = "";

        var success = await vm.SaveAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
        Assert.Null(apiClient.LastCreatedUser);
    }

    [Fact]
    public async Task SaveAsync_SurfacesTheBackendsErrorMessageWhenTheSaveIsRejected()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.CreateUserResult = new AdminWriteResult(false, "An ApartmentOwner must be assigned to an apartment that is Arrendado");

        var success = await vm.SaveAsync();

        Assert.False(success);
        Assert.Equal("An ApartmentOwner must be assigned to an apartment that is Arrendado", vm.ErrorMessage);
    }

    [Fact]
    public async Task SaveAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.ThrowOnCreateUser = true;

        var success = await vm.SaveAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
    }

    [Fact]
    public async Task DeleteAsync_DeletesTheUser()
    {
        var (apiClient, vm) = await MakeAsync(userId: 7);

        var success = await vm.DeleteAsync();

        Assert.True(success);
        Assert.Equal(7L, apiClient.LastDeletedUserId);
    }

    [Fact]
    public async Task DeleteAsync_DoesNotThrowWhenTheApiCallFails()
    {
        var (apiClient, vm) = await MakeAsync(userId: 7);
        apiClient.ThrowOnDeleteUser = true;

        var success = await vm.DeleteAsync();

        Assert.False(success);
    }

    [Fact]
    public async Task LoadApartmentsAsync_PopulatesApartmentsFromTheApi()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.Apartments = [new ApartmentModel { Id = 1, Name = "101", Status = "Arrendado" }];

        await vm.LoadApartmentsAsync();

        Assert.Single(vm.Apartments);
        Assert.Equal("101", vm.Apartments[0].Name);
    }
}
