using System.Text;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 017-icon-only-tab-bar T004: what the phone treats as read. A seen ledger per signed-in tenant maps an alert
// key to the alert date last seen; an alert is unread when its key is missing or its date is later.
public class AlertsReadTrackerTests
{
    private static readonly DateTime T0 = new(2026, 9, 16, 15, 0, 0, DateTimeKind.Utc);

    // A token whose payload carries the given `sub` claim (the tenant's user id).
    public static string Jwt(string sub)
    {
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{{\"sub\":\"{sub}\"}}"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"header.{payload}.signature";
    }

    private static AlertaModel Payment(string utility, int month, DateTime at) =>
        new() { Kind = "payment", Utility = utility, Month = month, Year = 2026, Status = "overdue", At = at };

    private static AlertaModel Confirmation(string utility, int month, DateTime at) =>
        new() { Kind = "confirmation", Utility = utility, Month = month, Year = 2026, At = at };

    private static AlertaModel Announcement(long id, DateTime at) =>
        new() { Kind = "announcement", Id = id, Title = "Aviso", Body = "Texto", At = at };

    private static async Task<(AlertsReadTracker Tracker, FakeAlertsSeenStore Store, FakeTokenStore Tokens)> Build(string userId = "7")
    {
        var store = new FakeAlertsSeenStore();
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync(Jwt(userId));
        return (new AlertsReadTracker(store, tokens), store, tokens);
    }

    [Fact]
    public void KeyOf_IsStableAndCarriesNoText()
    {
        Assert.Equal("a:4", AlertsReadTracker.KeyOf(Announcement(4, T0)));
        Assert.Equal("p:Agua:2026-9", AlertsReadTracker.KeyOf(Payment("Agua", 9, T0)));
        Assert.Equal("c:Agua:2026-9", AlertsReadTracker.KeyOf(Confirmation("Agua", 9, T0)));
    }

    [Fact]
    public async Task WithNothingSeenYet_EveryAlertIsUnread()
    {
        var (tracker, _, _) = await Build();
        var items = new[] { Payment("Agua", 9, T0), Announcement(1, T0), Confirmation("Gas", 9, T0) };

        Assert.Equal(3, await tracker.UnreadCountAsync(items));
        Assert.Equal(["a:1", "c:Gas:2026-9", "p:Agua:2026-9"], (await tracker.UnreadKeysAsync(items)).Order());
    }

    [Fact]
    public async Task AfterMarkSeen_NothingIsUnread()
    {
        var (tracker, _, _) = await Build();
        var items = new[] { Payment("Agua", 9, T0), Announcement(1, T0) };

        await tracker.MarkAllReadAsync(items);

        Assert.Equal(0, await tracker.UnreadCountAsync(items));
        Assert.Empty(await tracker.UnreadKeysAsync(items));
    }

    [Fact]
    public async Task ANewerDateForTheSameAlertIsUnreadAgain_AnUnchangedOneIsNot()
    {
        var (tracker, _, _) = await Build();
        await tracker.MarkAllReadAsync([Payment("Agua", 9, T0), Payment("Gas", 9, T0)]);

        var later = new[] { Payment("Agua", 9, T0.AddDays(1)), Payment("Gas", 9, T0) };

        Assert.Equal(["p:Agua:2026-9"], await tracker.UnreadKeysAsync(later));
    }

    [Fact]
    public async Task ANewAlertIsUnread_EvenWithAnOlderDateThanWhatWasSeen()
    {
        var (tracker, _, _) = await Build();
        await tracker.MarkAllReadAsync([Announcement(1, T0.AddDays(5))]);

        var items = new[] { Announcement(1, T0.AddDays(5)), Payment("Luz", 9, T0) };

        Assert.Equal(["p:Luz:2026-9"], await tracker.UnreadKeysAsync(items));
    }

    [Fact]
    public async Task MarkSeen_DropsKeysThatAreNoLongerListed()
    {
        var (tracker, store, _) = await Build();
        await tracker.MarkAllReadAsync([Announcement(1, T0), Announcement(2, T0)]);

        await tracker.MarkAllReadAsync([Announcement(2, T0)]);

        Assert.Equal(["a:2"], store.Stored("7")!.Keys);
    }

    [Fact]
    public async Task TheLedgerHoldsOnlyKeysAndDates()
    {
        var (tracker, store, _) = await Build();

        await tracker.MarkAllReadAsync([Announcement(1, T0)]);

        var stored = store.Stored("7")!;
        Assert.Equal(T0.Ticks, stored["a:1"]);
        Assert.Single(stored);
    }

    [Fact]
    public async Task EachTenantKeepsTheirOwnLedger()
    {
        var (tracker, store, tokens) = await Build("7");
        var items = new[] { Announcement(1, T0) };
        await tracker.MarkAllReadAsync(items);

        await tokens.SaveTokenAsync(Jwt("8"));
        Assert.Equal(1, await tracker.UnreadCountAsync(items));

        await tokens.SaveTokenAsync(Jwt("7"));
        Assert.Equal(0, await tracker.UnreadCountAsync(items));
        Assert.NotNull(store.Stored("7"));
        Assert.Null(store.Stored("8"));
    }

    [Fact]
    public async Task UnknownAlertKindsAreNeitherCountedNorRecorded()
    {
        var (tracker, store, _) = await Build();
        var items = new[] { new AlertaModel { Kind = "mystery", Id = 9, At = T0 }, Announcement(1, T0) };

        Assert.Equal(1, await tracker.UnreadCountAsync(items));
        await tracker.MarkAllReadAsync(items);
        Assert.Equal(["a:1"], store.Stored("7")!.Keys);
    }

    [Fact]
    public async Task AFailingStore_IsTreatedAsNothingSeen_AndNeverThrows()
    {
        var (tracker, store, _) = await Build();
        store.ThrowOnLoad = true;
        store.ThrowOnSave = true;
        var items = new[] { Announcement(1, T0) };

        Assert.Equal(1, await tracker.UnreadCountAsync(items));
        await tracker.MarkAllReadAsync(items);
    }

    [Fact]
    public async Task WithoutASession_NothingIsRecorded_AndEverythingCountsAsUnread()
    {
        var store = new FakeAlertsSeenStore();
        var tracker = new AlertsReadTracker(store, new FakeTokenStore());
        var items = new[] { Announcement(1, T0) };

        await tracker.MarkAllReadAsync(items);

        Assert.Equal(0, store.SaveCount);
        Assert.Equal(1, await tracker.UnreadCountAsync(items));
    }

    [Fact]
    public async Task ATokenWithoutAUserId_UsesASharedFallbackLedger()
    {
        var store = new FakeAlertsSeenStore();
        var tokens = new FakeTokenStore();
        await tokens.SaveTokenAsync("jwt");
        var tracker = new AlertsReadTracker(store, tokens);
        var items = new[] { Announcement(1, T0) };

        await tracker.MarkAllReadAsync(items);

        Assert.Equal(0, await tracker.UnreadCountAsync(items));
    }

    // ---- 017: an alert is read only when the tenant marks it (one by swipe, or all) ------------------------------------

    [Fact]
    public async Task MarkRead_RecordsOnlyThatAlert()
    {
        var (tracker, store, _) = await Build();
        var items = new[] { Announcement(1, T0), Announcement(2, T0) };

        await tracker.MarkReadAsync(items[0], items);

        Assert.Equal(["a:2"], await tracker.UnreadKeysAsync(items));
        Assert.Equal(["a:1"], store.Stored("7")!.Keys);
    }

    [Fact]
    public async Task MarkRead_KeepsTheOtherReadMarks_AndDropsAlertsNoLongerListed()
    {
        var (tracker, store, _) = await Build();
        await tracker.MarkAllReadAsync([Announcement(1, T0), Announcement(2, T0)]);
        var listed = new[] { Announcement(2, T0), Announcement(3, T0) };

        await tracker.MarkReadAsync(listed[1], listed);

        Assert.Equal(["a:2", "a:3"], store.Stored("7")!.Keys.Order());
        Assert.Empty(await tracker.UnreadKeysAsync(listed));
    }

    [Fact]
    public async Task MarkRead_ANewerDateForTheSameAlertIsUnreadAgain()
    {
        var (tracker, _, _) = await Build();
        await tracker.MarkReadAsync(Payment("Agua", 9, T0), [Payment("Agua", 9, T0)]);

        Assert.Equal(["p:Agua:2026-9"], await tracker.UnreadKeysAsync([Payment("Agua", 9, T0.AddDays(1))]));
    }

    [Fact]
    public async Task MarkRead_WithoutASession_OrWithAFailingStore_DoesNothingAndNeverThrows()
    {
        var store = new FakeAlertsSeenStore();
        var noSession = new AlertsReadTracker(store, new FakeTokenStore());
        var item = Announcement(1, T0);
        await noSession.MarkReadAsync(item, [item]);
        Assert.Equal(0, store.SaveCount);

        var (tracker, failing, _) = await Build();
        failing.ThrowOnLoad = true;
        failing.ThrowOnSave = true;
        await tracker.MarkReadAsync(item, [item]);
    }

    [Fact]
    public async Task MarkRead_IsPerTenant()
    {
        var (tracker, store, tokens) = await Build("7");
        var item = Announcement(1, T0);
        await tracker.MarkReadAsync(item, [item]);

        await tokens.SaveTokenAsync(Jwt("8"));

        Assert.Equal(1, await tracker.UnreadCountAsync([item]));
        Assert.Null(store.Stored("8"));
    }
}
