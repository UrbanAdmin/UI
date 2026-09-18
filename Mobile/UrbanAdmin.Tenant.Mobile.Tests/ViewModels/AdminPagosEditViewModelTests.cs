using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 008-mobile-admin-views T067 (Phase 6b): the admin Payments edit screen - select a
// Servicio/Mes/Año, see every apartment once, toggle paid / edit amount (saves immediately),
// set a shared deadline (rejected for Arriendo).
public class AdminPagosEditViewModelTests
{
    private static async Task<(FakeAdminApiClient ApiClient, AdminPagosEditViewModel Vm)> MakeAsync(string service = "Agua")
    {
        var apiClient = new FakeAdminApiClient();
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosEditViewModel(apiClient, tokenStore, new FakeCrashDiagnosticsService())
        {
            Service = service,
        };
        return (apiClient, vm);
    }

    [Fact]
    public async Task LoadUtilitiesAsync_PopulatesUtilitiesFromTheApi()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.Utilities = [new UtilityModel { Id = 1, Name = "Agua" }, new UtilityModel { Id = 2, Name = "Arriendo" }];

        await vm.LoadUtilitiesAsync();

        Assert.Equal(2, vm.Utilities.Count);
    }

    [Fact]
    public async Task LoadAsync_PopulatesItemsForTheSelectedServiceMonthAndYear()
    {
        var (apiClient, vm) = await MakeAsync();
        vm.Month = 10;
        vm.Year = 2026;
        apiClient.AdminPagos = [new AdminPagoRowModel { ApartmentId = 1, ApartmentNumber = "101", Utility = "Agua" }];

        await vm.LoadAsync();

        Assert.Single(vm.Items);
        Assert.Equal((null, (int?)10, (int?)2026, "Agua"), apiClient.LastGetAdminPagosArgs);
        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.ThrowOnGetAdminPagos = true;

        await vm.LoadAsync();

        Assert.True(vm.HasError);
    }

    [Fact]
    public void IsArriendo_IsTrueOnlyWhenServiceIsArriendo()
    {
        Assert.True(new AdminPagosEditViewModel(new FakeAdminApiClient(), new FakeTokenStore(), new FakeCrashDiagnosticsService()) { Service = "Arriendo" }.IsArriendo);
        Assert.False(new AdminPagosEditViewModel(new FakeAdminApiClient(), new FakeTokenStore(), new FakeCrashDiagnosticsService()) { Service = "Agua" }.IsArriendo);
    }

    [Fact]
    public async Task SetPaymentAsync_SavesTheAmountAndPaidStatusImmediately()
    {
        var (apiClient, vm) = await MakeAsync();
        vm.Month = 10;
        vm.Year = 2026;

        var success = await vm.SetPaymentAsync(apartmentId: 7, amount: "45000", paid: true);

        Assert.True(success);
        Assert.Equal((7L, "Agua", 10, 2026, "45000", true), apiClient.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task SetPaymentAsync_SurfacesTheBackendsErrorMessageWhenTheSaveIsRejected()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.SetAdminPagoPaymentResult = new AdminWriteResult(false, "Service not found");

        var success = await vm.SetPaymentAsync(apartmentId: 7, amount: "45000", paid: true);

        Assert.False(success);
        Assert.Equal("Service not found", vm.ErrorMessage);
    }

    [Fact]
    public async Task SetPaymentAsync_DoesNotThrowAndLogsApiErrorWhenTheApiCallFails()
    {
        var (apiClient, vm) = await MakeAsync();
        apiClient.ThrowOnSetAdminPagoPayment = true;

        var success = await vm.SetPaymentAsync(apartmentId: 7, amount: "45000", paid: true);

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
    }

    [Fact]
    public async Task SetDeadlineAsync_SavesTheDeadlineImmediately()
    {
        var (apiClient, vm) = await MakeAsync();
        vm.Month = 10;
        vm.Year = 2026;
        var dueDate = new DateTime(2026, 10, 15);

        var success = await vm.SetDeadlineAsync(dueDate);

        Assert.True(success);
        Assert.Equal(("Agua", 10, 2026, dueDate), apiClient.LastSetAdminPagoDeadline);
    }

    [Fact]
    public async Task SetDeadlineAsync_RejectsArriendoWithoutCallingTheApi()
    {
        var (apiClient, vm) = await MakeAsync(service: "Arriendo");

        var success = await vm.SetDeadlineAsync(new DateTime(2026, 10, 15));

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
        Assert.Null(apiClient.LastSetAdminPagoDeadline);
    }
}
