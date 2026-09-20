using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 013-tenant-pagos-alertas-redesign T030: the tenant Alertas view model turns the server's alert items
// into display cards (title, text, chip, relative date, dot/chip kind), keeps the tab badge in sync and
// keeps the app's Spanish load-state messages.
public class AlertasViewModelTests
{
    // 2026-09-16 10:00 in Colombia.
    private static readonly Func<DateTime> NowUtc = () => new DateTime(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static AlertaModel Payment(string utility, int month, string status, DateTime due, decimal? amount, DateTime at) =>
        new() { Kind = "payment", Utility = utility, Month = month, Year = 2026, Status = status, DueDate = due, AmountValue = amount, At = at };

    private static async Task<(AlertasViewModel Vm, FakeTenantApiClient Api, AlertsBadgeState Badge, FakeCrashDiagnosticsService Diag)> Build(AlertasModel? alertas = null)
    {
        var api = new FakeTenantApiClient { Alertas = alertas ?? new AlertasModel() };
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync("jwt");
        var badge = new AlertsBadgeState();
        var diag = new FakeCrashDiagnosticsService();
        return (new AlertasViewModel(api, tokens, diag, badge, NowUtc), api, badge, diag);
    }

    [Fact]
    public async Task PaymentCards_CarryTheTitleTextChipAndRelativeDate()
    {
        var (vm, _, _, _) = await Build(new AlertasModel
        {
            NeedsActionCount = 2,
            Items =
            [
                Payment("Energía", 9, "due-soon", new DateTime(2026, 9, 18), 132900m, new DateTime(2026, 9, 16, 13, 0, 0, DateTimeKind.Utc)),
                Payment("Agua", 9, "overdue", new DateTime(2026, 9, 15), 86400m, new DateTime(2026, 9, 15, 14, 0, 0, DateTimeKind.Utc)),
            ],
        });

        await vm.LoadAsync();

        Assert.Equal(2, vm.Cards.Count);
        var energia = vm.Cards[0];
        Assert.Equal(("Energía · septiembre", "Vence el 18 de septiembre. Valor $132.900.", "Vence en 2 días", "hoy", "due-soon"),
            (energia.Title, energia.Text, energia.Chip, energia.When, energia.Kind));
        var agua = vm.Cards[1];
        Assert.Equal(("Agua · septiembre", "Venció el 15 de septiembre. Valor $86.400.", "Vencido", "ayer", "overdue"),
            (agua.Title, agua.Text, agua.Chip, agua.When, agua.Kind));
    }

    [Fact]
    public async Task ADueTodayCardWithoutAnAmountOmitsTheValueSentence()
    {
        var (vm, _, _, _) = await Build(new AlertasModel
        {
            NeedsActionCount = 1,
            Items = [Payment("Gas", 9, "due-today", new DateTime(2026, 9, 16), null, new DateTime(2026, 9, 16, 12, 0, 0, DateTimeKind.Utc))],
        });

        await vm.LoadAsync();

        Assert.Equal(("Vence hoy.", "Vence hoy", "due-today"), (vm.Cards[0].Text, vm.Cards[0].Chip, vm.Cards[0].Kind));
    }

    [Fact]
    public async Task ConfirmationAndAnnouncementCards_UseTheirOwnChipsAndTexts()
    {
        var (vm, _, _, _) = await Build(new AlertasModel
        {
            Items =
            [
                new AlertaModel { Kind = "announcement", Id = 4, Title = "Mantenimiento del ascensor", Body = "Sábado de 8:00 a 12:00.", At = new DateTime(2026, 9, 15, 20, 0, 0, DateTimeKind.Utc) },
                new AlertaModel { Kind = "confirmation", Utility = "Administración", Month = 9, Year = 2026, AmountValue = 420000m, PaidAt = new DateTime(2026, 9, 5, 15, 0, 0, DateTimeKind.Utc), At = new DateTime(2026, 9, 5, 15, 0, 0, DateTimeKind.Utc) },
            ],
        });

        await vm.LoadAsync();

        var announcement = vm.Cards[0];
        Assert.Equal(("Mantenimiento del ascensor", "Sábado de 8:00 a 12:00.", "Comunicado", "ayer", "announcement"),
            (announcement.Title, announcement.Text, announcement.Chip, announcement.When, announcement.Kind));
        var confirmation = vm.Cards[1];
        Assert.Equal(("Administración · septiembre", "Recibimos tu pago de $420.000.", "Pago confirmado", "5 sep", "confirmation"),
            (confirmation.Title, confirmation.Text, confirmation.Chip, confirmation.When, confirmation.Kind));
    }

    [Fact]
    public async Task AnAnnouncementBodyIsNeverTruncated()
    {
        var longBody = new string('x', 900);
        var (vm, _, _, _) = await Build(new AlertasModel
        {
            Items = [new AlertaModel { Kind = "announcement", Title = "Aviso", Body = longBody, At = NowUtc() }],
        });

        await vm.LoadAsync();

        Assert.Equal(longBody, vm.Cards[0].Text);
    }

    [Fact]
    public async Task UnknownKindsAreSkipped()
    {
        var (vm, _, _, _) = await Build(new AlertasModel { Items = [new AlertaModel { Kind = "something-new", At = NowUtc() }] });

        await vm.LoadAsync();

        Assert.Empty(vm.Cards);
        Assert.True(vm.IsEmpty);
    }

    [Fact]
    public async Task LoadingUpdatesTheTabBadgeFromTheServersCount()
    {
        var (vm, _, badge, _) = await Build(new AlertasModel { NeedsActionCount = 3 });

        await vm.LoadAsync();

        Assert.Equal(3, badge.Count);
        Assert.True(badge.HasBadge);
    }

    [Fact]
    public async Task NoAlertsIsTheFriendlyEmptyState_AndClearsTheBadge()
    {
        var (vm, _, badge, _) = await Build();
        badge.Set(2);

        await vm.LoadAsync();

        Assert.True(vm.IsEmpty);
        Assert.False(vm.HasError);
        Assert.Equal(0, badge.Count);
    }

    [Fact]
    public async Task AFailedLoadShowsTheSpanishMessageAndKeepsThePreviousBadge()
    {
        var (vm, api, badge, diag) = await Build(new AlertasModel { NeedsActionCount = 2, Items = [Payment("Agua", 9, "overdue", new DateTime(2026, 9, 15), 1m, NowUtc())] });
        await vm.LoadAsync();

        api.ThrowOnGet = true;
        api.ThrowStatusCode = System.Net.HttpStatusCode.InternalServerError;
        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("No se pudieron cargar tus avisos. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
        Assert.Equal(2, badge.Count);
        Assert.Equal([("alertas", (int?)500)], diag.ApiErrors);
    }

    [Fact]
    public async Task ADeactivatedAccountGetsItsSpecificMessage()
    {
        var (vm, api, _, _) = await Build();
        api.ThrowOnGet = true;
        api.ThrowStatusCode = System.Net.HttpStatusCode.Forbidden;

        await vm.LoadAsync();

        Assert.Equal("Tu cuenta fue desactivada. Contacta a tu administrador.", vm.ErrorMessage);
    }

    [Fact]
    public async Task WithoutASessionItAsksToSignInAgain()
    {
        var api = new FakeTenantApiClient();
        var vm = new AlertasViewModel(api, new FakeTokenStore(), new FakeCrashDiagnosticsService(), new AlertsBadgeState(), NowUtc);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("Sesión no válida. Inicia sesión de nuevo.", vm.ErrorMessage);
        Assert.Equal(0, api.GetAlertasCallCount);
    }
}
