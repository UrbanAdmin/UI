using System.Text.Json;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Services;

// 017-icon-only-tab-bar: the phone's memory of the alerts each tenant has seen. One MAUI Preferences entry
// per tenant (alerts-seen:{userId}) holding a small JSON map of alert key -> date ticks. It contains no alert
// text or amounts, so ordinary preferences (not secure storage) are enough, like the last-used username.
// A missing or unreadable value loads as null ("nothing seen").
public class PreferencesAlertsSeenStore : IAlertsSeenStore
{
    private static string KeyFor(string userId) => $"alerts-seen:{userId}";

    public Dictionary<string, long>? Load(string userId)
    {
        try
        {
            var json = Preferences.Default.Get(KeyFor(userId), string.Empty);
            return string.IsNullOrEmpty(json) ? null : JsonSerializer.Deserialize<Dictionary<string, long>>(json);
        }
        catch (Exception)
        {
            return null;
        }
    }

    public void Save(string userId, Dictionary<string, long> seen) =>
        Preferences.Default.Set(KeyFor(userId), JsonSerializer.Serialize(seen));
}
