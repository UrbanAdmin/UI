using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 017-icon-only-tab-bar: which alerts the signed-in tenant has not read. The phone keeps a "seen ledger" per
// tenant (alert key -> the alert date last seen); an alert is unread when its key is missing or its date is
// later than the recorded one. Comparing the server's own dates with each other keeps this independent of the
// phone's clock. Never throws: a failing store simply means "nothing seen".
public class AlertsReadTracker(IAlertsSeenStore store, ITokenStore tokenStore)
{
    // A token without a user id still gets a ledger (shared), so the count behaves rather than failing.
    private const string FallbackUser = "unknown";

    // Stable across loads and free of text: announcement a:{id}; payment reminder p:{utility}:{year}-{month};
    // paid confirmation c:{utility}:{year}-{month}. Unknown kinds have no key (they are never shown).
    public static string? KeyOf(AlertaModel alert) => alert.Kind switch
    {
        "announcement" => $"a:{alert.Id}",
        "payment" => $"p:{alert.Utility}:{alert.Year}-{alert.Month}",
        "confirmation" => $"c:{alert.Utility}:{alert.Year}-{alert.Month}",
        _ => null,
    };

    public async Task<List<string>> UnreadKeysAsync(IEnumerable<AlertaModel> items)
    {
        var seen = await LoadAsync();
        var unread = new List<string>();
        foreach (var item in items)
        {
            var key = KeyOf(item);
            if (key is null)
            {
                continue;
            }

            if (seen is null || !seen.TryGetValue(key, out var seenAt) || item.At.Ticks > seenAt)
            {
                unread.Add(key);
            }
        }

        return unread;
    }

    public async Task<int> UnreadCountAsync(IEnumerable<AlertaModel> items) => (await UnreadKeysAsync(items)).Count;

    // Records every shown alert with its date and drops keys that are no longer listed, so the ledger cannot grow.
    public async Task MarkSeenAsync(IEnumerable<AlertaModel> items)
    {
        var userId = await UserIdAsync();
        if (userId is null)
        {
            return;
        }

        var seen = new Dictionary<string, long>();
        foreach (var item in items)
        {
            var key = KeyOf(item);
            if (key is not null)
            {
                seen[key] = item.At.Ticks;
            }
        }

        try
        {
            store.Save(userId, seen);
        }
        catch (Exception)
        {
            // Remembering is a convenience; the next load simply shows them as new again.
        }
    }

    private async Task<Dictionary<string, long>?> LoadAsync()
    {
        var userId = await UserIdAsync();
        if (userId is null)
        {
            return null;
        }

        try
        {
            return store.Load(userId);
        }
        catch (Exception)
        {
            return null;
        }
    }

    // Null when nobody is signed in (nothing is read or recorded); otherwise the token's user id.
    private async Task<string?> UserIdAsync()
    {
        var token = await tokenStore.GetTokenAsync();
        return token is null ? null : JwtClaimsReader.GetUserId(token) ?? FallbackUser;
    }
}
