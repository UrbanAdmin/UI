using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class ApartmentEditViewModelTests
{
    private static async Task<(FakeAdminApiClient ApiClient, ApartmentEditViewModel Vm)> MakeAsync(long? apartmentId = null)
    {
        var apiClient = new FakeAdminApiClient();
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new ApartmentEditViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService())
        {
            ApartmentId = apartmentId,
            Name = "101",
            Owner = "Ana",
            Status = "Arrendado",
        };
        return (apiClient, vm);
    }

    [Fact]
    public async Task SaveAsync_CreatesANewApartmentWhenApartmentIdIsNull()
    {
        var (apiClient, vm) = await MakeAsync();

        var success = await vm.SaveAsync();

        Assert.True(success);
        Assert.Equal(("101", "Ana", (DateTime?)null, "Arrendado"), apiClient.LastCreatedApartment);
        Assert.Null(apiClient.LastUpdatedApartment);
    }

    [Fact]
    public async Task SaveAsync_UpdatesTheExistingApartmentWhenApartmentIdIsSet()
    {
        var (apiClient, vm) = await MakeAsync(apartmentId: 7);

        var success = await vm.SaveAsync();

        Assert.True(success);
        Assert.Equal((7L, "101", "Ana", (DateTime?)null, "Arrendado"), apiClient.LastUpdatedApartment);
        Assert.Null(apiClient.LastCreatedApartment);
    }

    [Fact]
    public async Task SaveAsync_FailsValidationWhenArrendadoHasNoOwner()
    {
        var (apiClient, vm) = await MakeAsync();
        vm.Owner = "";

        var success = await vm.SaveAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
        Assert.Null(apiClient.LastCreatedApartment);
    }

    [Fact]
    public async Task SaveAsync_SurfacesTheBackendsErrorMessageWhenTheSaveIsRejected()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.CreateApartmentResult = new AdminWriteResult(false, "An ApartmentOwner must be assigned an apartment");

        var success = await vm.SaveAsync();

        Assert.False(success);
        Assert.Equal("An ApartmentOwner must be assigned an apartment", vm.ErrorMessage);
    }

    [Fact]
    public async Task SaveAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.ThrowOnCreateApartment = true;

        var success = await vm.SaveAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
    }

    [Fact]
    public async Task DeleteAsync_DeletesTheApartment()
    {
        var (apiClient, vm) = await MakeAsync(apartmentId: 7);

        var success = await vm.DeleteAsync();

        Assert.True(success);
        Assert.Equal(7L, apiClient.LastDeletedApartmentId);
    }

    [Fact]
    public async Task DeleteAsync_DoesNotThrowWhenTheApiCallFails()
    {
        var (apiClient, vm) = await MakeAsync(apartmentId: 7);
        apiClient.ThrowOnDeleteApartment = true;

        var success = await vm.DeleteAsync();

        Assert.False(success);
    }

    [Fact]
    public async Task UploadContractAsync_UploadsTheFile()
    {
        var (apiClient, vm) = await MakeAsync(apartmentId: 7);
        using var content = new MemoryStream([1, 2, 3]);

        var success = await vm.UploadContractAsync(content, "contrato.pdf", "application/pdf");

        Assert.True(success);
        Assert.Equal((7L, "contrato.pdf", "application/pdf"), apiClient.LastUploadedContract);
    }

    [Fact]
    public async Task UploadContractAsync_DoesNotThrowWhenTheApiCallFails()
    {
        var (apiClient, vm) = await MakeAsync(apartmentId: 7);
        apiClient.ThrowOnUploadContract = true;
        using var content = new MemoryStream([1, 2, 3]);

        var success = await vm.UploadContractAsync(content, "contrato.pdf", "application/pdf");

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
    }
}
