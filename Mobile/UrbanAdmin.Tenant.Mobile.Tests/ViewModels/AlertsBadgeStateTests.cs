using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 013-tenant-pagos-alertas-redesign T028: the count shown on the Alertas tab (payment alerts that need
// action). One shared state; the shell/pages subscribe to Changed. AlertsBadgeService keeps it fresh
// from screens other than Alertas (app start, Pagos appearing).
public class AlertsBadgeStateTests
{
    [Fact]
    public void StartsWithNoBadge()
    {
        var state = new AlertsBadgeState();

        Assert.Equal(0, state.Count);
        Assert.False(state.HasBadge);
    }

    [Fact]
    public void Set_UpdatesTheCount_AndRaisesChangedOnlyWhenItChanges()
    {
        var state = new AlertsBadgeState();
        var raised = 0;
        state.Changed += () => raised++;

        state.Set(2);
        state.Set(2);
        state.Set(3);

        Assert.Equal(3, state.Count);
        Assert.True(state.HasBadge);
        Assert.Equal(2, raised);
    }

    [Fact]
    public void ZeroOrANegativeCountHidesTheBadge()
    {
        var state = new AlertsBadgeState();
        state.Set(2);

        state.Set(0);
        Assert.False(state.HasBadge);

        state.Set(-4);
        Assert.Equal(0, state.Count);
    }

    [Fact]
    public void Reset_ClearsTheBadge_AndNotifies()
    {
        var state = new AlertsBadgeState();
        state.Set(5);
        var raised = 0;
        state.Changed += () => raised++;

        state.Reset();

        Assert.False(state.HasBadge);
        Assert.Equal(1, raised);
    }
}

public class AlertsBadgeServiceTests
{
    private static readonly DateTime Now = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    private static AlertaModel Announce(long id, DateTime at) =>
        new() { Kind = "announcement", Id = id, Title = "Aviso", Body = "Texto", At = at };

    private static AlertaModel Payment(string utility, DateTime at) =>
        new() { Kind = "payment", Utility = utility, Month = 9, Year = 2026, Status = "overdue", At = at };

    private static async Task<(AlertsBadgeService Service, AlertsBadgeState State, FakeTenantApiClient Api, AlertsReadTracker Tracker, FakeTokenStore Tokens)> Build(bool withToken = true)
    {
        var api = new FakeTenantApiClient
        {
            Alertas = new AlertasModel
            {
                NeedsActionCount = 9, // the server's count is no longer used for the badge
                Items = [Announce(1, Now), Payment("Agua", Now), new AlertaModel { Kind = "confirmation", Utility = "Gas", Month = 9, Year = 2026, At = Now }],
            },
        };
        var tokens = new FakeTokenStore();
        if (withToken)
        {
            await tokens.SaveTokenAsync(AlertsReadTrackerTests.Jwt("7"));
        }

        var state = new AlertsBadgeState();
        var tracker = new AlertsReadTracker(new FakeAlertsSeenStore(), tokens);
        return (new AlertsBadgeService(api, tokens, state, tracker), state, api, tracker, tokens);
    }

    [Fact]
    public async Task RefreshAsync_SetsTheBadgeToTheUnreadCount_OfEveryAlertKind()
    {
        var (service, state, api, _, _) = await Build();

        await service.RefreshAsync();

        Assert.Equal(3, state.Count);
        Assert.Equal(1, api.GetAlertasCallCount);
    }

    [Fact]
    public async Task RefreshAsync_NeverMarksAlertsAsSeen()
    {
        var (service, state, _, tracker, _) = await Build();

        await service.RefreshAsync();
        await service.RefreshAsync();

        Assert.Equal(3, state.Count);
        Assert.Equal(3, await tracker.UnreadCountAsync(
            [Announce(1, Now), Payment("Agua", Now), new AlertaModel { Kind = "confirmation", Utility = "Gas", Month = 9, Year = 2026, At = Now }]));
    }

    [Fact]
    public async Task RefreshAsync_AfterTheTenantReadEverything_ShowsNoNumber_UntilSomethingNewArrives()
    {
        var (service, state, api, tracker, _) = await Build();
        await tracker.MarkAllReadAsync(api.Alertas.Items);

        await service.RefreshAsync();
        Assert.Equal(0, state.Count);

        api.Alertas.Items.Insert(0, Announce(2, Now.AddHours(1)));
        await service.RefreshAsync();
        Assert.Equal(1, state.Count);
    }

    [Fact]
    public async Task RefreshAsync_ANewerReminderForAChargeCountsAgain_AStillOverdueChargeDoesNot()
    {
        var (service, state, api, tracker, _) = await Build();
        await tracker.MarkAllReadAsync(api.Alertas.Items);

        api.Alertas.Items[1] = Payment("Agua", Now.AddDays(1));
        await service.RefreshAsync();

        Assert.Equal(1, state.Count);
    }

    [Fact]
    public async Task RefreshAsync_EachTenantSeesTheirOwnCount()
    {
        var (service, state, api, tracker, tokens) = await Build();
        await tracker.MarkAllReadAsync(api.Alertas.Items);
        await service.RefreshAsync();
        Assert.Equal(0, state.Count);

        await tokens.SaveTokenAsync(AlertsReadTrackerTests.Jwt("8"));
        await service.RefreshAsync();
        Assert.Equal(3, state.Count);

        await tokens.SaveTokenAsync(AlertsReadTrackerTests.Jwt("7"));
        await service.RefreshAsync();
        Assert.Equal(0, state.Count);
    }

    [Fact]
    public async Task RefreshAsync_WithoutASession_DoesNothing()
    {
        var (service, state, api, _, _) = await Build(withToken: false);

        await service.RefreshAsync();

        Assert.Equal(0, state.Count);
        Assert.Equal(0, api.GetAlertasCallCount);
    }

    [Fact]
    public async Task RefreshAsync_AFailureKeepsThePreviousBadgeAndNeverThrows()
    {
        var (service, state, api, _, _) = await Build();
        await service.RefreshAsync();
        api.ThrowOnGet = true;

        await service.RefreshAsync();

        Assert.Equal(3, state.Count);
    }
}
