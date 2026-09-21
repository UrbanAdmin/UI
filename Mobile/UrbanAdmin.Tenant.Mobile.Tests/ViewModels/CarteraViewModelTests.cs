using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 012-cartera-vencida-timeline: the Cartera screen's view model. US1 = load states (this section);
// US2 adds BuildPagosRoute; US3 adds the notify members.
public class CarteraViewModelTests
{
    private static CarteraModel OneYearOneMonth() => new()
    {
        TotalServicios = 91200,
        TotalArriendo = 1600000,
        Total = 1691200,
        ChargeCount = 2,
        ApartmentCount = 1,
        Years =
        [
            new CarteraYearModel
            {
                Year = 2026,
                Total = 1691200,
                Months = [new CarteraMonthModel { Month = 9, Year = 2026, Total = 1691200, ChargeCount = 2, ApartmentCount = 1 }],
            },
        ],
    };

    private static async Task<(CarteraViewModel Vm, FakeAdminApiClient Api, FakeCrashDiagnosticsService Diagnostics)> Build(bool withToken = true)
    {
        var api = new FakeAdminApiClient { CarteraResult = OneYearOneMonth() };
        var tokenStore = new FakeTokenStore();
        if (withToken)
        {
            await tokenStore.SaveTokenAsync("admin-jwt");
        }

        var diagnostics = new FakeCrashDiagnosticsService();
        return (new CarteraViewModel(api, tokenStore, diagnostics), api, diagnostics);
    }

    [Fact]
    public async Task LoadAsync_PopulatesTheCarteraFromTheApi()
    {
        var (vm, api, _) = await Build();

        await vm.LoadAsync();

        Assert.Equal(1691200m, vm.Cartera.Total);
        Assert.Single(vm.Cartera.Years);
        Assert.False(vm.HasError);
        Assert.False(vm.IsBusy);
        Assert.False(vm.IsEmpty);
        Assert.Equal(1, api.GetCarteraCallCount);
    }

    [Fact]
    public async Task IsEmpty_IsFalseBeforeAnythingHasLoaded()
    {
        var (vm, _, _) = await Build();

        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_ReportsEmptyWhenNothingIsOverdue()
    {
        var (vm, api, _) = await Build();
        api.CarteraResult = new CarteraModel();

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
        Assert.False(vm.HasError);
    }

    [Fact]
    public async Task LoadAsync_IsNotEmptyWhenOnlyAmountlessChargesExist()
    {
        var (vm, api, _) = await Build();
        api.CarteraResult = new CarteraModel
        {
            Total = 0,
            ChargeCount = 1,
            ApartmentCount = 1,
            Years = [new CarteraYearModel { Year = 2026, Months = [new CarteraMonthModel { Month = 9, Year = 2026, ChargeCount = 1 }] }],
        };

        await vm.LoadAsync();

        Assert.False(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadAsync_SetsASessionErrorWhenThereIsNoToken()
    {
        var (vm, api, _) = await Build(withToken: false);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("Sesión no válida. Inicia sesión de nuevo.", vm.ErrorMessage);
        Assert.Equal(0, api.GetCarteraCallCount);
    }

    [Fact]
    public async Task LoadAsync_SetsAGenericMessageOnAnyOtherFailure()
    {
        var (vm, api, _) = await Build();
        api.ThrowOnGetCartera = true;
        api.CarteraThrowStatusCode = System.Net.HttpStatusCode.InternalServerError;

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.False(vm.IsBusy);
        Assert.Equal("No se pudo cargar la cartera. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
    }

    [Fact]
    public async Task LoadAsync_SetsADeactivatedAccountMessageOnA403()
    {
        var (vm, api, _) = await Build();
        api.ThrowOnGetCartera = true;
        api.CarteraThrowStatusCode = System.Net.HttpStatusCode.Forbidden;

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("Tu cuenta fue desactivada. Contacta a tu administrador.", vm.ErrorMessage);
    }

    [Fact]
    public async Task LoadAsync_ForwardsTheHttpStatusCodeToDiagnostics()
    {
        var (vm, api, diagnostics) = await Build();
        api.ThrowOnGetCartera = true;
        api.CarteraThrowStatusCode = System.Net.HttpStatusCode.InternalServerError;

        await vm.LoadAsync();

        Assert.Equal([("admin-cartera", (int?)500)], diagnostics.ApiErrors);
    }

    [Fact]
    public async Task LoadAsync_RecoversOnRetryAfterAFailure()
    {
        var (vm, api, _) = await Build();
        api.ThrowOnGetCartera = true;
        await vm.LoadAsync();
        Assert.True(vm.HasError);

        api.ThrowOnGetCartera = false;
        await vm.LoadAsync();

        Assert.False(vm.HasError);
        Assert.Equal(1691200m, vm.Cartera.Total);
    }

    // ---- US2: the detailed Pagos screen is a secondary route opened from Cartera --------------

    [Fact]
    public async Task BuildPagosRoute_CarriesTheChosenMonthAndYear()
    {
        var (vm, _, _) = await Build();

        Assert.Equal("AdminPagos?month=9&year=2026", vm.BuildPagosRoute(9, 2026));
    }

    // ---- US3: notify (bulk and per apartment) -----------------------------------------------

    // September 2026 (the selected month in these tests) with one 10.000 charge per apartment given.
    private static CarteraMonthModel SeptemberFor(params long[] apartmentIds) => new()
    {
        Month = 9,
        Year = 2026,
        Charges = apartmentIds
            .Select(id => new CarteraChargeModel { ApartmentId = id, ApartmentNumber = id.ToString(), Service = "Agua", Amount = 10000m })
            .ToList(),
    };

    private static readonly Func<DateTime> September2026 = () => new DateTime(2026, 9, 20);

    private static CarteraModel WithApartments() => new()
    {
        Total = 2232400,
        ChargeCount = 5,
        ApartmentCount = 4,
        Years = [new CarteraYearModel { Year = 2026, Months = [SeptemberFor(1, 2, 3, 4)] }],
        Apartments =
        [
            new CarteraApartmentModel { ApartmentId = 1, ApartmentNumber = "101", Owner = "Carlos", ChargeCount = 2, Total = 121200, CanNotify = true },
            new CarteraApartmentModel
            {
                ApartmentId = 2, ApartmentNumber = "202", Owner = "Yesenia", ChargeCount = 3, Total = 2111200, CanNotify = true,
                NotifiedToday = true, LastNotifiedAt = new DateTime(2026, 10, 20, 14, 5, 0, DateTimeKind.Utc),
            },
            new CarteraApartmentModel { ApartmentId = 3, ApartmentNumber = "405", Owner = null, ChargeCount = 1, CanNotify = false, CannotNotifyReason = "Apartamento sin arrendar" },
            new CarteraApartmentModel { ApartmentId = 4, ApartmentNumber = "301", Owner = "Luis", ChargeCount = 1, CanNotify = false, CannotNotifyReason = "Sin propietario activo" },
        ],
    };

    private static async Task<(CarteraViewModel Vm, FakeAdminApiClient Api, FakeCrashDiagnosticsService Diagnostics)> BuildLoaded(CarteraModel? cartera = null)
    {
        var api = new FakeAdminApiClient
        {
            CarteraResult = cartera ?? WithApartments(),
            NotificarResult = new CarteraNotifyResultModel { RequestedApartments = 4, NotifiedApartments = 2, UnreachableApartments = 2 },
        };
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("admin-jwt");
        var diagnostics = new FakeCrashDiagnosticsService();
        // Bogota is UTC-5: makes the "a las HH:mm" text deterministic on any machine.
        var vm = new CarteraViewModel(api, tokenStore, diagnostics, toLocalTime: utc => utc.AddHours(-5), today: September2026);
        await vm.LoadAsync();
        return (vm, api, diagnostics);
    }

    [Fact]
    public async Task CanNotifyAll_IsTrueOnlyWhenAtLeastOneApartmentCanBeNotified()
    {
        var (vm, api, _) = await BuildLoaded();
        Assert.True(vm.CanNotifyAll);

        api.CarteraResult = new CarteraModel
        {
            Years = [new CarteraYearModel { Year = 2026, Months = [SeptemberFor(3)] }],
            Apartments = [new CarteraApartmentModel { ApartmentId = 3, CanNotify = false, CannotNotifyReason = "Apartamento sin arrendar" }],
        };
        await vm.LoadAsync();
        Assert.False(vm.CanNotifyAll);

        api.CarteraResult = new CarteraModel();
        await vm.LoadAsync();
        Assert.False(vm.CanNotifyAll);
    }

    [Fact]
    public async Task BuildBulkConfirmation_StatesWhoWillBeNotified_WhoCannot_AndWhoAlreadyWasToday()
    {
        var (vm, _, _) = await BuildLoaded();

        Assert.Equal(
            "Se notificará a 2 apartamentos con cartera vencida de septiembre 2026.\n" +
            "2 apartamentos no se pueden notificar (sin arrendar o sin propietario activo).\n" +
            "1 ya recibió una notificación hoy. Puedes enviarla de nuevo.",
            vm.BuildBulkConfirmation());
    }

    [Fact]
    public async Task BuildBulkConfirmation_OmitsTheLinesThatDoNotApply_AndUsesSingularForms()
    {
        var (vm, _, _) = await BuildLoaded(new CarteraModel
        {
            Years = [new CarteraYearModel { Year = 2026, Months = [SeptemberFor(1)] }],
            Apartments = [new CarteraApartmentModel { ApartmentId = 1, ApartmentNumber = "101", CanNotify = true }],
        });

        Assert.Equal("Se notificará a 1 apartamento con cartera vencida de septiembre 2026.", vm.BuildBulkConfirmation());
    }

    [Fact]
    public async Task BuildBulkConfirmation_PluralizesTheAlreadyNotifiedLine()
    {
        var model = WithApartments();
        model.Apartments[0].NotifiedToday = true;
        var (vm, _, _) = await BuildLoaded(model);

        Assert.Contains("2 ya recibieron una notificación hoy. Puedes enviarla de nuevo.", vm.BuildBulkConfirmation());
    }

    [Fact]
    public async Task BuildApartmentConfirmation_NamesTheApartmentAndTheCurrentMonthsBalance()
    {
        var model = WithApartments();
        // Apartment 1 has two September charges (10.000 + 15.000); its other months must not count.
        model.Years[0].Months[0].Charges.Add(new CarteraChargeModel { ApartmentId = 1, ApartmentNumber = "1", Service = "Luz", Amount = 15000m });
        var (vm, _, _) = await BuildLoaded(model);

        Assert.Equal(
            "Se enviará a Carlos el detalle de su cartera vencida de septiembre 2026: 2 conceptos por $25.000.",
            vm.BuildApartmentConfirmation(1));
    }

    [Fact]
    public async Task BuildApartmentConfirmation_WarnsWithTheLocalTimeWhenAlreadyNotifiedToday()
    {
        var (vm, _, _) = await BuildLoaded();

        Assert.Equal(
            "Se enviará a Yesenia el detalle de su cartera vencida de septiembre 2026: 1 concepto por $10.000.\n" +
            "Ya se notificó hoy a las 09:05. Puedes enviarla de nuevo.",
            vm.BuildApartmentConfirmation(2));
    }

    [Fact]
    public async Task NotifyAllAsync_SendsToEveryApartment_AndReportsTheCounts()
    {
        var (vm, api, _) = await BuildLoaded();

        var outcome = await vm.NotifyAllAsync();

        Assert.Null(api.LastNotificarApartmentId);
        Assert.Equal(1, api.NotificarCallCount);
        Assert.True(outcome.Success);
        Assert.Equal("Notificación enviada a 2 apartamentos · 2 no se pudieron notificar", outcome.Message);
        Assert.False(vm.IsSending);
    }

    [Theory]
    [InlineData(1, 0, "Notificación enviada a 1 apartamento")]
    [InlineData(3, 0, "Notificación enviada a 3 apartamentos")]
    [InlineData(2, 1, "Notificación enviada a 2 apartamentos · 1 no se pudo notificar")]
    public async Task NotifyAllAsync_WordsTheResultForEachCombination(int notified, int unreachable, string expected)
    {
        var (vm, api, _) = await BuildLoaded();
        api.NotificarResult = new CarteraNotifyResultModel { RequestedApartments = notified + unreachable, NotifiedApartments = notified, UnreachableApartments = unreachable };

        var outcome = await vm.NotifyAllAsync();

        Assert.True(outcome.Success);
        Assert.Equal(expected, outcome.Message);
    }

    [Fact]
    public async Task NotifyAllAsync_DoesNotClaimSuccessWhenNobodyCouldBeReached()
    {
        var (vm, api, _) = await BuildLoaded();
        api.NotificarResult = new CarteraNotifyResultModel { RequestedApartments = 2, NotifiedApartments = 0, UnreachableApartments = 2 };

        var outcome = await vm.NotifyAllAsync();

        Assert.False(outcome.Success);
        Assert.Equal("Ningún apartamento se pudo notificar (sin arrendar o sin propietario activo).", outcome.Message);
    }

    [Fact]
    public async Task NotifyApartmentAsync_SendsOnlyToThatApartment()
    {
        var (vm, api, _) = await BuildLoaded();
        api.NotificarResult = new CarteraNotifyResultModel { RequestedApartments = 1, NotifiedApartments = 1 };

        var outcome = await vm.NotifyApartmentAsync(1);

        Assert.Equal(1L, api.LastNotificarApartmentId);
        Assert.True(outcome.Success);
        Assert.Equal("Notificación enviada al apto 101", outcome.Message);
    }

    [Fact]
    public async Task NotifyApartmentAsync_ExplainsWhenTheApartmentCannotBeReached()
    {
        var (vm, api, _) = await BuildLoaded();
        api.NotificarResult = new CarteraNotifyResultModel { RequestedApartments = 1, NotifiedApartments = 0, UnreachableApartments = 1 };

        var outcome = await vm.NotifyApartmentAsync(3);

        Assert.False(outcome.Success);
        Assert.Equal("El apto 405 no se puede notificar: Apartamento sin arrendar.", outcome.Message);
    }

    [Fact]
    public async Task NotifyAllAsync_ReloadsTheBalanceSoNotifiedTodayIsUpToDate()
    {
        var (vm, api, _) = await BuildLoaded();
        var loadsBefore = api.GetCarteraCallCount;

        await vm.NotifyAllAsync();

        Assert.Equal(loadsBefore + 1, api.GetCarteraCallCount);
    }

    [Fact]
    public async Task NotifyAllAsync_ReturnsAClearErrorAndDoesNotClaimSuccessWhenTheSendFails()
    {
        var (vm, api, diagnostics) = await BuildLoaded();
        api.ThrowOnNotificar = true;
        api.NotificarThrowStatusCode = System.Net.HttpStatusCode.InternalServerError;
        var loadsBefore = api.GetCarteraCallCount;

        var outcome = await vm.NotifyAllAsync();

        Assert.False(outcome.Success);
        Assert.Equal("No se pudo enviar la notificación. Verifica tu conexión e intenta de nuevo.", outcome.Message);
        Assert.False(vm.IsSending);
        Assert.Equal([("admin-cartera-notificar", (int?)500)], diagnostics.ApiErrors);
        Assert.Equal(loadsBefore, api.GetCarteraCallCount);
    }

    [Fact]
    public async Task NotifyAllAsync_SaysTheAccountWasDeactivatedOnA403()
    {
        var (vm, api, _) = await BuildLoaded();
        api.ThrowOnNotificar = true;
        api.NotificarThrowStatusCode = System.Net.HttpStatusCode.Forbidden;

        var outcome = await vm.NotifyAllAsync();

        Assert.False(outcome.Success);
        Assert.Equal("Tu cuenta fue desactivada. Contacta a tu administrador.", outcome.Message);
    }

    [Fact]
    public async Task NotifyAllAsync_IgnoresASecondPressWhileASendIsInFlight()
    {
        var (vm, api, _) = await BuildLoaded();
        api.NotificarGate = new TaskCompletionSource<bool>();

        var first = vm.NotifyAllAsync();
        Assert.True(vm.IsSending);
        var second = await vm.NotifyAllAsync();

        Assert.False(second.Success);
        Assert.Equal(1, api.NotificarCallCount);

        api.NotificarGate.SetResult(true);
        var firstOutcome = await first;
        Assert.True(firstOutcome.Success);
        Assert.False(vm.IsSending);
    }

    [Fact]
    public async Task NotifyAllAsync_NeedsASession()
    {
        var api = new FakeAdminApiClient { CarteraResult = WithApartments() };
        var vm = new CarteraViewModel(api, new FakeTokenStore(), new FakeCrashDiagnosticsService(), today: September2026);

        var outcome = await vm.NotifyAllAsync();

        Assert.False(outcome.Success);
        Assert.Equal("Sesión no válida. Inicia sesión de nuevo.", outcome.Message);
        Assert.Equal(0, api.NotificarCallCount);
    }
}
