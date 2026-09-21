namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// 017-icon-only-tab-bar: what the phone remembers about the alerts a signed-in tenant has seen - a map from
// an alert key to the alert date (UTC ticks) last seen. Kept per tenant, on the phone only; it holds no alert
// text. The real implementation wraps MAUI Preferences; a missing or unreadable value loads as null.
public interface IAlertsSeenStore
{
    Dictionary<string, long>? Load(string userId);

    void Save(string userId, Dictionary<string, long> seen);
}
