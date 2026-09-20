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
    private static async Task<(AlertsBadgeService Service, AlertsBadgeState State, FakeTenantApiClient Api)> Build(bool withToken = true)
    {
        var api = new FakeTenantApiClient { Alertas = new AlertasModel { NeedsActionCount = 2 } };
        var tokens = new FakeTokenStore();
        if (withToken)
        {
            await tokens.SaveTokenAsync("jwt");
        }

        var state = new AlertsBadgeState();
        return (new AlertsBadgeService(api, tokens, state), state, api);
    }

    [Fact]
    public async Task RefreshAsync_SetsTheBadgeFromTheServersCount()
    {
        var (service, state, api) = await Build();

        await service.RefreshAsync();

        Assert.Equal(2, state.Count);
        Assert.Equal(1, api.GetAlertasCallCount);
    }

    [Fact]
    public async Task RefreshAsync_WithoutASession_DoesNothing()
    {
        var (service, state, api) = await Build(withToken: false);

        await service.RefreshAsync();

        Assert.Equal(0, state.Count);
        Assert.Equal(0, api.GetAlertasCallCount);
    }

    [Fact]
    public async Task RefreshAsync_AFailureKeepsThePreviousBadgeAndNeverThrows()
    {
        var (service, state, api) = await Build();
        await service.RefreshAsync();
        api.ThrowOnGet = true;

        await service.RefreshAsync();

        Assert.Equal(2, state.Count);
    }
}
