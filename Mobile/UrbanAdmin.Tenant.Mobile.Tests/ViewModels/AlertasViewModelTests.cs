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
        var (vm, api, badge, diag, _) = await BuildWithTracker(alertas);
        return (vm, api, badge, diag);
    }

    private static async Task<(AlertasViewModel Vm, FakeTenantApiClient Api, AlertsBadgeState Badge, FakeCrashDiagnosticsService Diag, AlertsReadTracker Tracker)> BuildWithTracker(AlertasModel? alertas = null)
    {
        var api = new FakeTenantApiClient { Alertas = alertas ?? new AlertasModel() };
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync(AlertsReadTrackerTests.Jwt("7"));
        var badge = new AlertsBadgeState();
        var diag = new FakeCrashDiagnosticsService();
        var tracker = new AlertsReadTracker(new FakeAlertsSeenStore(), tokens);
        return (new AlertasViewModel(api, tokens, diag, badge, tracker, NowUtc), api, badge, diag, tracker);
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
    public async Task LoadingClearsTheTabBadge_TheServersCountIsNoLongerUsed()
    {
        var (vm, _, badge, _) = await Build(new AlertasModel { NeedsActionCount = 3 });
        badge.Set(3);

        await vm.LoadAsync();

        Assert.Equal(0, badge.Count);
        Assert.False(badge.HasBadge);
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
        badge.Set(2);

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
        var vm = new AlertasViewModel(api, new FakeTokenStore(), new FakeCrashDiagnosticsService(), new AlertsBadgeState(), new AlertsReadTracker(new FakeAlertsSeenStore(), new FakeTokenStore()), NowUtc);

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal("Sesión no válida. Inicia sesión de nuevo.", vm.ErrorMessage);
        Assert.Equal(0, api.GetAlertasCallCount);
    }

    // ---- 017: alerts are read by the tenant (swipe / "Marcar todas"), never by opening the screen -----------------------

    private static AlertaModel Announce(long id, DateTime at) =>
        new() { Kind = "announcement", Id = id, Title = "Aviso " + id, Body = "Texto", At = at };

    private static async Task<(AlertasViewModel Vm, FakeTenantApiClient Api, AlertsBadgeState Badge, AlertsReadTracker Tracker, FakeAlertsSeenStore Store)> BuildAll(params AlertaModel[] items)
    {
        var api = new FakeTenantApiClient { Alertas = new AlertasModel { NeedsActionCount = 99, Items = [.. items] } };
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync(AlertsReadTrackerTests.Jwt("7"));
        var badge = new AlertsBadgeState();
        var store = new FakeAlertsSeenStore();
        var tracker = new AlertsReadTracker(store, tokens);
        return (new AlertasViewModel(api, tokens, new FakeCrashDiagnosticsService(), badge, tracker, NowUtc), api, badge, tracker, store);
    }

    [Fact]
    public async Task LoadAsync_NeverMarksAnythingRead_AndTheBadgeIsTheUnreadCount()
    {
        var (vm, _, badge, tracker, _) = await BuildAll(Announce(1, NowUtc()), Announce(2, NowUtc()));

        await vm.LoadAsync();
        await vm.LoadAsync();

        Assert.Equal(2, badge.Count);
        Assert.Equal(2, vm.Cards.Count);
        Assert.Equal(2, await tracker.UnreadCountAsync([Announce(1, NowUtc()), Announce(2, NowUtc())]));
    }

    [Fact]
    public async Task Cards_ListsOnlyTheUnread_AllCardsListsEverything()
    {
        var (vm, _, badge, tracker, _) = await BuildAll(Announce(2, NowUtc()), Announce(1, NowUtc().AddDays(-1)));
        await tracker.MarkAllReadAsync([Announce(1, NowUtc().AddDays(-1))]);

        await vm.LoadAsync();

        Assert.Equal(["Aviso 2"], vm.Cards.Select(c => c.Title));
        Assert.Equal(["Aviso 2", "Aviso 1"], vm.AllCards.Select(c => c.Title));
        Assert.Equal([true, false], vm.AllCards.Select(c => c.IsUnread));
        Assert.Equal(1, badge.Count);
        Assert.True(vm.HasUnread);
    }

    [Fact]
    public async Task MarkReadAsync_RemovesTheCardFromTheList_LowersTheBadge_AndItStaysInTheFullList()
    {
        var (vm, _, badge, _, _) = await BuildAll(Announce(1, NowUtc()), Announce(2, NowUtc()));
        await vm.LoadAsync();
        var first = vm.Cards[0];

        await vm.MarkReadAsync(first);

        Assert.Equal(["Aviso 2"], vm.Cards.Select(c => c.Title));
        Assert.False(first.IsUnread);
        Assert.Equal(1, badge.Count);
        Assert.Equal(2, vm.AllCards.Count);
        Assert.Contains(first, vm.AllCards);
    }

    [Fact]
    public async Task MarkReadAsync_IsRememberedOnTheNextLoad()
    {
        var (vm, _, badge, _, _) = await BuildAll(Announce(1, NowUtc()), Announce(2, NowUtc()));
        await vm.LoadAsync();
        await vm.MarkReadAsync(vm.Cards[0]);

        await vm.LoadAsync();

        Assert.Single(vm.Cards);
        Assert.Equal(1, badge.Count);
    }

    [Fact]
    public async Task MarkReadAsync_OnAReadCard_DoesNothing()
    {
        var (vm, _, badge, _, store) = await BuildAll(Announce(1, NowUtc()));
        await vm.LoadAsync();
        var card = vm.Cards[0];
        await vm.MarkReadAsync(card);
        var saves = store.SaveCount;

        await vm.MarkReadAsync(card);

        Assert.Equal(saves, store.SaveCount);
        Assert.Equal(0, badge.Count);
    }

    [Fact]
    public async Task MarkAllReadAsync_ClearsTheListAndTheBadge_AndItIsRemembered()
    {
        var (vm, _, badge, _, _) = await BuildAll(Announce(1, NowUtc()), Announce(2, NowUtc()), Announce(3, NowUtc()));
        await vm.LoadAsync();

        await vm.MarkAllReadAsync();

        Assert.Empty(vm.Cards);
        Assert.False(vm.HasUnread);
        Assert.True(vm.IsEmpty);
        Assert.Equal(0, badge.Count);
        Assert.All(vm.AllCards, c => Assert.False(c.IsUnread));

        await vm.LoadAsync();
        Assert.Empty(vm.Cards);
        Assert.Equal(3, vm.AllCards.Count);
    }

    [Fact]
    public async Task ANewOrChangedAlertAfterMarkingAll_IsTheOnlyOneListed()
    {
        var (vm, api, badge, _, _) = await BuildAll(Announce(1, NowUtc().AddDays(-2)), Payment("Agua", 9, "overdue", new DateTime(2026, 9, 15), 1000m, NowUtc().AddDays(-1)));
        await vm.LoadAsync();
        await vm.MarkAllReadAsync();

        api.Alertas.Items.Insert(0, Announce(2, NowUtc()));                                                                // new announcement
        api.Alertas.Items[2] = Payment("Agua", 9, "overdue", new DateTime(2026, 9, 15), 1000m, NowUtc());                  // newer reminder
        await vm.LoadAsync();

        Assert.Equal(["Aviso 2", "Agua · septiembre"], vm.Cards.Select(c => c.Title));
        Assert.Equal(2, badge.Count);
    }

    [Fact]
    public async Task Marking_StillUpdatesTheScreen_WhenThePhoneCannotRememberIt()
    {
        var (vm, _, badge, _, store) = await BuildAll(Announce(1, NowUtc()), Announce(2, NowUtc()));
        await vm.LoadAsync();
        store.ThrowOnSave = true;

        await vm.MarkReadAsync(vm.Cards[0]);

        Assert.Single(vm.Cards);
        Assert.Equal(1, badge.Count);
    }

    [Fact]
    public async Task ACard_RaisesPropertyChanged_WhenItIsMarkedRead()
    {
        var (vm, _, _, _, _) = await BuildAll(Announce(1, NowUtc()));
        await vm.LoadAsync();
        var card = vm.Cards[0];
        var changed = new List<string?>();
        card.PropertyChanged += (_, e) => changed.Add(e.PropertyName);

        await vm.MarkReadAsync(card);

        Assert.Contains(nameof(card.IsUnread), changed);
        Assert.Contains(nameof(card.AccessibleName), changed);
    }

    [Fact]
    public async Task AccessibleName_AnnouncesUnreadCardsAsNew_AndOnlyThoseAreOfferedTheAction()
    {
        var (vm, _, _, tracker, _) = await BuildAll(Announce(2, NowUtc()), Announce(1, NowUtc().AddDays(-1)));
        await tracker.MarkAllReadAsync([Announce(1, NowUtc().AddDays(-1))]);

        await vm.LoadAsync();

        Assert.StartsWith("Nuevo. ", vm.AllCards[0].AccessibleName);
        Assert.DoesNotContain("Nuevo", vm.AllCards[1].AccessibleName);
        Assert.Contains("Aviso 2", vm.AllCards[0].AccessibleName);
    }

    [Fact]
    public async Task ACardKeepsItsTextChipAndDate_WhenItIsMarkedRead()
    {
        var (vm, _, _, _, _) = await BuildAll(Announce(1, new DateTime(2026, 9, 15, 20, 0, 0, DateTimeKind.Utc)));
        await vm.LoadAsync();

        await vm.MarkReadAsync(vm.Cards[0]);

        var card = vm.AllCards[0];
        Assert.Equal(("Aviso 1", "Texto", "Comunicado", "ayer"), (card.Title, card.Text, card.Chip, card.When));
    }

    [Fact]
    public async Task AFailedLoad_LeavesTheCardsAndTheBadgeAsTheyWere()
    {
        var (vm, api, badge, _, _) = await BuildAll(Announce(1, NowUtc()));
        await vm.LoadAsync();
        api.ThrowOnGet = true;

        await vm.LoadAsync();

        Assert.True(vm.HasError);
        Assert.Equal(1, badge.Count);
    }
}
