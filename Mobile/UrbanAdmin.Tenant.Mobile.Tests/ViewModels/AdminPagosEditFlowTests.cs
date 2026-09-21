using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 014-admin-pagos-first-tab US4: the redesigned "Editar pagos" - rows with a visible save state, the paid
// summary and the deadline card state (approved mockup Mockups/admin-pagos-edit).
public class AdminPagosEditFlowTests
{
    private static AdminPagoRowModel Item(long apt, string number, string? owner, string? amount, bool paid,
        DateTime? due = null, long? id = 1) =>
        new()
        {
            ApartmentId = apt,
            ApartmentNumber = number,
            Owner = owner,
            Utility = "Agua",
            Amount = amount,
            Paid = paid,
            DueDate = due ?? new DateTime(2026, 9, 10),
            PaymentStatusId = id,
        };

    private static async Task<(FakeAdminApiClient Api, AdminPagosEditViewModel Vm)> LoadedAsync(
        string service = "Agua", params AdminPagoRowModel[] items)
    {
        var api = new FakeAdminApiClient { AdminPagos = items.ToList() };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosEditViewModel(api, tokenStore, new FakeCrashDiagnosticsService()) { Service = service, Month = 9, Year = 2026 };
        await vm.LoadAsync();
        return (api, vm);
    }

    // ---- rows -------------------------------------------------------------------------------

    [Fact]
    public async Task LoadAsync_BuildsOneRowPerApartmentOrderedByNumber()
    {
        var (_, vm) = await LoadedAsync("Agua",
            Item(3, "301", "Diana Ruiz", "72100", true),
            Item(2, "202", "Camilo Ochoa", "79800", false),
            Item(4, "402", "", "0", false));

        Assert.Equal(["202 · Camilo Ochoa", "301 · Diana Ruiz", "402 · Sin propietario"], vm.Rows.Select(r => r.Title));
        Assert.Equal(["Camilo Ochoa", "Diana Ruiz", "Sin propietario"], vm.Rows.Select(r => r.OwnerText));
    }

    [Fact]
    public async Task Row_ReadsAmountPaidAndStatusFromTheItem()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false), Item(3, "301", "Diana", "72100", true));

        Assert.Equal(("79800", false, "Pendiente", "pending", "$79.800"),
            (vm.Rows[0].Amount, vm.Rows[0].Paid, vm.Rows[0].StatusLabel, vm.Rows[0].StatusKind, vm.Rows[0].AmountDisplay));
        Assert.Equal(("Pagado", "paid"), (vm.Rows[1].StatusLabel, vm.Rows[1].StatusKind));
    }

    [Fact]
    public async Task Row_WithoutAPaymentRecordReadsSinRegistrar()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", null, false, id: null));

        Assert.False(vm.Rows[0].IsRegistered);
        Assert.Equal("Sin registrar", vm.Rows[0].SaveMessage);
    }

    [Fact]
    public async Task Row_ThatIsRegisteredAndUntouchedHasNoMessage()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        Assert.Equal(string.Empty, vm.Rows[0].SaveMessage);
        Assert.False(vm.Rows[0].ShowRetry);
    }

    [Fact]
    public async Task PaidSummary_CountsThePaidRows()
    {
        var (_, vm) = await LoadedAsync("Agua",
            Item(1, "101", "A", "1", true), Item(2, "202", "B", "1", false), Item(3, "301", "C", "1", true));

        Assert.Equal("2 pagados de 3", vm.PaidSummary);
    }

    [Fact]
    public async Task PaidSummary_UsesTheSingularForOne()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(1, "101", "A", "1", true), Item(2, "202", "B", "1", false));

        Assert.Equal("1 pagado de 2", vm.PaidSummary);
    }

    // ---- saving with a visible state --------------------------------------------------------

    [Fact]
    public async Task SaveRowAsync_ShowsGuardandoThenGuardado_AndRegistersTheRow()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", null, false, id: null));
        var row = vm.Rows[0];
        var messages = new List<string>();
        row.PropertyChanged += (_, e) =>
        {
            if (e.PropertyName == nameof(row.SaveMessage))
            {
                messages.Add(row.SaveMessage);
            }
        };
        row.Amount = "79800";

        var ok = await vm.SaveRowAsync(row);

        Assert.True(ok);
        Assert.Equal(["Guardando…", "Guardado ✓"], messages);
        Assert.True(row.IsRegistered);
        Assert.Equal((2L, "Agua", 9, 2026, "79800", false), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task SaveRowAsync_WhenTheSaveFails_KeepsTheEnteredValueAndOffersRetry()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        api.ThrowOnSetAdminPagoPayment = true;
        var row = vm.Rows[0];
        row.Amount = "85000";

        var ok = await vm.SaveRowAsync(row);

        Assert.False(ok);
        Assert.Equal("No se guardó. Revisa la conexión.", row.SaveMessage);
        Assert.True(row.ShowRetry);
        Assert.Equal("85000", row.Amount);
    }

    [Fact]
    public async Task SaveRowAsync_WhenTheBackendRejectsIt_ShowsTheSameFailureState()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        api.SetAdminPagoPaymentResult = new AdminWriteResult(false, "Service not found");

        await vm.SaveRowAsync(vm.Rows[0]);

        Assert.True(vm.Rows[0].ShowRetry);
        Assert.Equal("Service not found", vm.ErrorMessage);
    }

    [Fact]
    public async Task SaveRowAsync_RetryAfterAFailureSucceedsAndClearsTheError()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        api.ThrowOnSetAdminPagoPayment = true;
        await vm.SaveRowAsync(vm.Rows[0]);
        api.ThrowOnSetAdminPagoPayment = false;

        var ok = await vm.SaveRowAsync(vm.Rows[0]);

        Assert.True(ok);
        Assert.False(vm.Rows[0].ShowRetry);
        Assert.Equal("Guardado ✓", vm.Rows[0].SaveMessage);
    }

    [Fact]
    public async Task CommitAmountAsync_SavesTheTypedAmountAsDigits()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", true));

        await vm.CommitAmountAsync(vm.Rows[0], "$85.000");

        Assert.Equal("85000", vm.Rows[0].Amount);
        Assert.Equal("$85.000", vm.Rows[0].AmountDisplay);
        Assert.Equal((2L, "Agua", 9, 2026, "85000", true), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task CommitAmountAsync_DoesNotSaveWhenTheAmountDidNotChange()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        await vm.CommitAmountAsync(vm.Rows[0], "$79.800");

        Assert.Null(api.LastSetAdminPagoPayment);
        Assert.Equal(string.Empty, vm.Rows[0].SaveMessage);
    }

    [Fact]
    public async Task CommitAmountAsync_ClearingTheFieldSavesAnEmptyAmount()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        await vm.CommitAmountAsync(vm.Rows[0], "");

        Assert.Null(vm.Rows[0].Amount);
        Assert.Equal((2L, "Agua", 9, 2026, (string?)null, false), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task TogglePaidAsync_FlipsTheStatusAndSaves()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        await vm.TogglePaidAsync(vm.Rows[0]);

        Assert.True(vm.Rows[0].Paid);
        Assert.Equal("Pagado", vm.Rows[0].StatusLabel);
        Assert.Equal("1 pagado de 1", vm.PaidSummary);
        Assert.Equal((2L, "Agua", 9, 2026, "79800", true), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task TogglePaidAsync_WhenTheSaveFails_KeepsTheNewStatusWithRetry()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        api.ThrowOnSetAdminPagoPayment = true;

        await vm.TogglePaidAsync(vm.Rows[0]);

        Assert.True(vm.Rows[0].Paid);
        Assert.True(vm.Rows[0].ShowRetry);
    }

    // ---- deadline card ----------------------------------------------------------------------

    [Fact]
    public async Task Deadline_ShowsTheSavedDate()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false, due: new DateTime(2026, 9, 10)));

        Assert.Equal("10 de septiembre", vm.DeadlineDisplay);
        Assert.True(vm.ShowDeadlineCard);
        Assert.False(vm.DeadlineDirty);
        Assert.Equal("Fecha límite de agua", vm.DeadlineTitle);
    }

    [Fact]
    public async Task Deadline_WithoutASavedDateReadsSinFecha()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false, due: DateTime.MinValue));

        Assert.Equal("Sin fecha", vm.DeadlineDisplay);
    }

    [Fact]
    public async Task Deadline_ForArriendoHasNoCardButAContractNote()
    {
        var (_, vm) = await LoadedAsync("Arriendo", Item(2, "202", "Camilo Ochoa", "900000", false));

        Assert.False(vm.ShowDeadlineCard);
        Assert.Contains("contrato", vm.ArriendoHint);
    }

    [Fact]
    public async Task SetPendingDeadline_MarksItDirtyUntilSaved()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        vm.SetPendingDeadline(new DateTime(2026, 9, 25));

        Assert.True(vm.DeadlineDirty);
        Assert.Equal("10 de septiembre", vm.DeadlineDisplay);
        Assert.Equal(string.Empty, vm.DeadlineNote);
    }

    [Fact]
    public async Task SetPendingDeadline_ToTheSavedDateIsNotDirty()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false, due: new DateTime(2026, 9, 10)));

        vm.SetPendingDeadline(new DateTime(2026, 9, 10));

        Assert.False(vm.DeadlineDirty);
    }

    [Fact]
    public async Task SaveDeadlineAsync_SavesClearsDirtyAndConfirms()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        vm.SetPendingDeadline(new DateTime(2026, 9, 25));

        var ok = await vm.SaveDeadlineAsync();

        Assert.True(ok);
        Assert.False(vm.DeadlineDirty);
        Assert.Equal("25 de septiembre", vm.DeadlineDisplay);
        Assert.Equal("Fecha guardada ✓", vm.DeadlineNote);
        Assert.Equal(("Agua", 9, 2026, new DateTime(2026, 9, 25)), api.LastSetAdminPagoDeadline);
    }

    [Fact]
    public async Task SaveDeadlineAsync_WhenItFails_StaysDirtyWithTheError()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        api.ThrowOnSetAdminPagoDeadline = true;
        vm.SetPendingDeadline(new DateTime(2026, 9, 25));

        var ok = await vm.SaveDeadlineAsync();

        Assert.False(ok);
        Assert.True(vm.DeadlineDirty);
        Assert.Equal(string.Empty, vm.DeadlineNote);
        Assert.NotNull(vm.ErrorMessage);
    }

    [Fact]
    public async Task SaveDeadlineAsync_WithNothingPendingDoesNothing()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        var ok = await vm.SaveDeadlineAsync();

        Assert.False(ok);
        Assert.Null(api.LastSetAdminPagoDeadline);
    }

    [Fact]
    public async Task ReloadingClearsThePendingDeadlineAndTheNote()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        vm.SetPendingDeadline(new DateTime(2026, 9, 25));
        await vm.SaveDeadlineAsync();

        await vm.LoadAsync();

        Assert.Equal(string.Empty, vm.DeadlineNote);
        Assert.False(vm.DeadlineDirty);
    }

    // ---- service buttons --------------------------------------------------------------------

    [Fact]
    public async Task ServiceNames_ComeFromTheUtilities()
    {
        var (api, vm) = await LoadedAsync("Agua");
        api.Utilities = [new UtilityModel { Id = 1, Name = "Administración" }, new UtilityModel { Id = 2, Name = "Agua" }];

        await vm.LoadUtilitiesAsync();

        Assert.Equal(["Administración", "Agua"], vm.ServiceNames);
    }
}
