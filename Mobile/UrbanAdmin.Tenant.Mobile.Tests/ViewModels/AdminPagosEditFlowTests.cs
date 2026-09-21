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

    // ---- 016-fix-edit-service-values: every edit belongs to the service and month it was made in ---------------------

    // A token store that runs a callback while a save is in flight, so the test can change the screen's selection at the
    // exact moment the old code read it (after the first await).
    private sealed class SwitchingTokenStore(Action onGetToken) : ITokenStore
    {
        public Task<string?> GetTokenAsync()
        {
            onGetToken();
            return Task.FromResult<string?>("admin-jwt");
        }

        public Task SaveTokenAsync(string token) => Task.CompletedTask;

        public Task ClearTokenAsync() => Task.CompletedTask;
    }

    private static AdminPagoRowModel PagoRow(long apt, string number, string utility, string? amount, bool paid, long? id = 1) =>
        new()
        {
            ApartmentId = apt, ApartmentNumber = number, Owner = "Ana", Utility = utility, Amount = amount, Paid = paid,
            DueDate = new DateTime(2026, 9, 10), PaymentStatusId = id,
        };

    [Fact]
    public async Task Rows_KnowTheServiceMonthAndYearTheyWereLoadedFor()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        Assert.Equal(("Agua", 9, 2026), (vm.Rows[0].Service, vm.Rows[0].Month, vm.Rows[0].Year));
    }

    [Fact]
    public async Task SaveRowAsync_AfterTheSelectionChanged_SavesToTheRowsOwnServiceAndMonth()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        var row = vm.Rows[0];
        vm.Service = "Gas";
        vm.Month = 10;

        await vm.SaveRowAsync(row);

        Assert.Equal((2L, "Agua", 9, 2026, "79800", false), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task CommitAmountAsync_ForAnOldRow_SavesToItsOwnService()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", true));
        var row = vm.Rows[0];
        vm.Service = "Gas";

        await vm.CommitAmountAsync(row, "$85.000");

        Assert.Equal((2L, "Agua", 9, 2026, "85000", true), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task TogglePaidAsync_ForAnOldRow_SavesToItsOwnService()
    {
        var (api, vm) = await LoadedAsync("Energía", Item(2, "202", "Camilo Ochoa", "1000", false));
        var row = vm.Rows[0];
        vm.Service = "Administración";

        await vm.TogglePaidAsync(row);

        Assert.Equal((2L, "Energía", 9, 2026, "1000", true), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task ARetryAfterAFailure_TargetsTheOriginalSelection()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        var row = vm.Rows[0];
        api.ThrowOnSetAdminPagoPayment = true;
        await vm.SaveRowAsync(row);
        vm.Service = "Gas";
        vm.Year = 2027;
        api.ThrowOnSetAdminPagoPayment = false;

        await vm.SaveRowAsync(row);

        Assert.Equal((2L, "Agua", 9, 2026, "79800", false), api.LastSetAdminPagoPayment);
        Assert.Equal(1, api.SavedAdminPagoPayments.Count);
    }

    [Fact]
    public async Task ASelectionChangeWhileTheSaveIsInFlight_DoesNotRedirectIt()
    {
        var api = new FakeAdminApiClient { AdminPagos = [Item(2, "202", "Camilo Ochoa", "79800", false)] };
        AdminPagosEditViewModel? vm = null;
        var tokens = new SwitchingTokenStore(() => { if (vm is not null && vm.Service == "Agua") { vm.Service = "Gas"; } });
        vm = new AdminPagosEditViewModel(api, tokens, new FakeCrashDiagnosticsService()) { Service = "Agua", Month = 9, Year = 2026 };
        await vm.LoadAsync();
        vm.Service = "Agua";

        await vm.SaveRowAsync(vm.Rows[0]);

        Assert.Equal("Agua", api.LastSetAdminPagoPayment!.Value.Service);
    }

    // ---- stale loads --------------------------------------------------------------------------------------------------

    private static (FakeAdminApiClient Api, AdminPagosEditViewModel Vm, Dictionary<string, TaskCompletionSource> Gates) Overlapping()
    {
        var api = new FakeAdminApiClient();
        api.AdminPagosByService["Administración"] = [PagoRow(1, "101", "Administración", "420000", true)];
        api.AdminPagosByService["Agua"] = [PagoRow(1, "101", "Agua", "86400", false), PagoRow(2, "202", "Agua", null, false, id: null)];
        var gates = new Dictionary<string, TaskCompletionSource>
        {
            ["Administración"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
            ["Agua"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
        };
        api.BeforeGetAdminPagos = (service, _, _) => gates[service!].Task;
        var tokens = new FakeTokenStore();
        tokens.SaveTokenAsync("admin-jwt").GetAwaiter().GetResult();
        return (api, new AdminPagosEditViewModel(api, tokens, new FakeCrashDiagnosticsService()) { Month = 9, Year = 2026 }, gates);
    }

    [Fact]
    public async Task LoadAsync_AnOlderResponseArrivingLast_IsDiscarded()
    {
        var (_, vm, gates) = Overlapping();
        vm.Service = "Administración";
        var first = vm.LoadAsync();
        vm.Service = "Agua";
        var second = vm.LoadAsync();

        gates["Agua"].SetResult();
        Assert.True(await second);
        gates["Administración"].SetResult();
        Assert.False(await first);

        Assert.Equal(["Agua", "Agua"], vm.Rows.Select(r => r.Service));
        Assert.Equal(2, vm.Rows.Count);
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task LoadAsync_AnOlderResponseArrivingFirst_IsAlsoDiscarded_AndTheScreenStaysBusyUntilTheLatestEnds()
    {
        var (_, vm, gates) = Overlapping();
        vm.Service = "Administración";
        var first = vm.LoadAsync();
        vm.Service = "Agua";
        var second = vm.LoadAsync();

        gates["Administración"].SetResult();
        Assert.False(await first);
        Assert.True(vm.IsBusy);
        Assert.Empty(vm.Rows);

        gates["Agua"].SetResult();
        Assert.True(await second);
        Assert.False(vm.IsBusy);
        Assert.Equal(2, vm.Rows.Count);
    }

    [Fact]
    public async Task LoadAsync_AStaleFailureDoesNotSetTheErrorState()
    {
        var (api, vm, gates) = Overlapping();
        api.BeforeGetAdminPagos = async (service, _, _) =>
        {
            await gates[service!].Task;
            if (service == "Administración")
            {
                throw new HttpRequestException("boom");
            }
        };
        vm.Service = "Administración";
        var first = vm.LoadAsync();
        vm.Service = "Agua";
        var second = vm.LoadAsync();

        gates["Agua"].SetResult();
        await second;
        gates["Administración"].SetResult();
        Assert.False(await first);

        Assert.False(vm.HasError);
        Assert.Equal(2, vm.Rows.Count);
    }

    [Fact]
    public async Task EachServiceShowsItsOwnValues_AndAnUnrecordedApartmentIsSinRegistrar()
    {
        var (_, vm, gates) = Overlapping();
        gates["Administración"].SetResult();
        gates["Agua"].SetResult();

        vm.Service = "Administración";
        await vm.LoadAsync();
        var admin = vm.Rows.Select(r => (r.Number, r.Amount, r.SaveMessage)).ToList();
        vm.Service = "Agua";
        await vm.LoadAsync();
        var agua = vm.Rows.Select(r => (r.Number, r.Amount, r.SaveMessage)).ToList();

        Assert.Equal([("101", (string?)"420000", "")], admin);
        Assert.Equal([("101", (string?)"86400", ""), ("202", (string?)null, "Sin registrar")], agua);
    }

    [Fact]
    public async Task ChangingTheMonth_LoadsThatMonthsOwnRowsAndIgnoresTheOlderLoad()
    {
        var api = new FakeAdminApiClient();
        var gates = new Dictionary<int, TaskCompletionSource>
        {
            [9] = new(TaskCreationOptions.RunContinuationsAsynchronously),
            [10] = new(TaskCreationOptions.RunContinuationsAsynchronously),
        };
        api.BeforeGetAdminPagos = (_, month, _) => gates[month!.Value].Task;
        api.AdminPagos = [PagoRow(1, "101", "Agua", "86400", true)];
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosEditViewModel(api, tokens, new FakeCrashDiagnosticsService()) { Service = "Agua", Year = 2026, Month = 9 };
        var september = vm.LoadAsync();
        vm.Month = 10;
        var october = vm.LoadAsync();

        gates[10].SetResult();
        await october;
        gates[9].SetResult();
        Assert.False(await september);

        Assert.Equal(10, vm.Rows[0].Month);
        Assert.Equal("Fecha límite de agua", vm.DeadlineTitle);
    }

    // ---- the deadline save captures its own selection ------------------------------------------------------------------

    [Fact]
    public async Task SaveDeadlineAsync_ASelectionChangeWhileSaving_StillSavesForTheOriginalService()
    {
        var api = new FakeAdminApiClient { AdminPagos = [Item(2, "202", "Camilo Ochoa", "79800", false)] };
        AdminPagosEditViewModel? vm = null;
        var tokens = new SwitchingTokenStore(() => { if (vm is not null && vm.Service == "Agua") { vm.Service = "Gas"; } });
        vm = new AdminPagosEditViewModel(api, tokens, new FakeCrashDiagnosticsService()) { Service = "Agua", Month = 9, Year = 2026 };
        await vm.LoadAsync();
        vm.Service = "Agua";
        vm.SetPendingDeadline(new DateTime(2026, 9, 25));

        await vm.SaveDeadlineAsync();

        Assert.Equal(("Agua", 9, 2026, new DateTime(2026, 9, 25)), api.LastSetAdminPagoDeadline);
    }

    [Fact]
    public async Task SaveDeadlineAsync_ASavedDateOfAnotherSelectionDoesNotChangeTheCurrentCard()
    {
        var api = new FakeAdminApiClient { AdminPagos = [Item(2, "202", "Camilo Ochoa", "79800", false, due: new DateTime(2026, 9, 10))] };
        AdminPagosEditViewModel? vm = null;
        var tokens = new SwitchingTokenStore(() => { if (vm is not null && vm.Service == "Agua") { vm.Service = "Gas"; } });
        vm = new AdminPagosEditViewModel(api, tokens, new FakeCrashDiagnosticsService()) { Service = "Agua", Month = 9, Year = 2026 };
        await vm.LoadAsync();
        vm.Service = "Agua";
        vm.SetPendingDeadline(new DateTime(2026, 9, 25));

        await vm.SaveDeadlineAsync();

        Assert.Equal("10 de septiembre", vm.DeadlineDisplay);
        Assert.Equal(string.Empty, vm.DeadlineNote);
    }

    // ---- 016: the amount box is bound two-way to the row (EditText) and the page never writes the box's text ----------

    [Fact]
    public async Task EditText_StartsAsTheFormattedAmount()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false), Item(3, "301", "Diana", null, false, id: null));

        Assert.Equal("$79.800", vm.Rows[0].EditText);
        Assert.Equal(string.Empty, vm.Rows[1].EditText);
    }

    [Fact]
    public async Task BeginEdit_ShowsThePlainDigitsForTyping()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));

        vm.Rows[0].BeginEdit();

        Assert.True(vm.Rows[0].IsEditing);
        Assert.Equal("79800", vm.Rows[0].EditText);
    }

    [Fact]
    public async Task CommitAmountAsync_SavesTheTypedTextAndGoesBackToTheFormattedAmount()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        var row = vm.Rows[0];
        row.BeginEdit();
        row.EditText = "85000";

        await vm.CommitAmountAsync(row, row.EditText);

        Assert.False(row.IsEditing);
        Assert.Equal("$85.000", row.EditText);
        Assert.Equal((2L, "Agua", 9, 2026, "85000", false), api.LastSetAdminPagoPayment);
    }

    [Fact]
    public async Task CommitAmountAsync_WithoutAChange_StillLeavesTheBoxFormatted()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        var row = vm.Rows[0];
        row.BeginEdit();

        await vm.CommitAmountAsync(row, row.EditText);

        Assert.Null(api.LastSetAdminPagoPayment);
        Assert.False(row.IsEditing);
        Assert.Equal("$79.800", row.EditText);
    }

    [Fact]
    public async Task CommitAmountAsync_WhenTheSaveFails_KeepsTheEnteredAmountShownFormatted()
    {
        var (api, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        api.ThrowOnSetAdminPagoPayment = true;
        var row = vm.Rows[0];
        row.BeginEdit();
        row.EditText = "85000";

        await vm.CommitAmountAsync(row, row.EditText);

        Assert.True(row.ShowRetry);
        Assert.Equal("$85.000", row.EditText);
    }

    [Fact]
    public async Task EditText_FollowsAChangeOfTheAmountWhileNotEditing()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        var row = vm.Rows[0];
        var changes = new List<string?>();
        row.PropertyChanged += (_, e) => changes.Add(e.PropertyName);

        row.Amount = "90000";

        Assert.Equal("$90.000", row.EditText);
        Assert.Contains(nameof(row.EditText), changes);
    }

    [Fact]
    public async Task EditText_IsNotOverwrittenByAmountChangesWhileTyping()
    {
        var (_, vm) = await LoadedAsync("Agua", Item(2, "202", "Camilo Ochoa", "79800", false));
        var row = vm.Rows[0];
        row.BeginEdit();
        row.EditText = "9";

        row.Amount = "90000";

        Assert.Equal("9", row.EditText);
    }

    [Fact]
    public async Task NewRowsAfterAServiceChange_StartFromTheirOwnAmounts_NotFromEditedText()
    {
        var api = new FakeAdminApiClient();
        api.AdminPagosByService["Gas"] = [Item(2, "202", "Camilo Ochoa", "41200", false)];
        api.AdminPagosByService["Agua"] = [Item(2, "202", "Camilo Ochoa", null, false, id: null)];
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync("admin-jwt");
        var vm = new AdminPagosEditViewModel(api, tokens, new FakeCrashDiagnosticsService()) { Service = "Gas", Month = 8, Year = 2026 };
        await vm.LoadAsync();
        var gas = vm.Rows[0];
        gas.BeginEdit();
        gas.EditText = "99999";
        await vm.CommitAmountAsync(gas, gas.EditText);

        vm.Service = "Agua";
        await vm.LoadAsync();

        Assert.Equal(string.Empty, vm.Rows[0].EditText);
        Assert.Null(vm.Rows[0].Amount);
        Assert.NotSame(gas, vm.Rows[0]);
    }
}
