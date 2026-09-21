using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

// In-memory stand-in for what the phone remembers (017-icon-only-tab-bar): one map per signed-in tenant.
public class FakeAlertsSeenStore : IAlertsSeenStore
{
    private readonly Dictionary<string, Dictionary<string, long>> _byUser = [];

    public bool ThrowOnLoad { get; set; }
    public bool ThrowOnSave { get; set; }
    public int SaveCount { get; private set; }

    public Dictionary<string, long>? Load(string userId)
    {
        if (ThrowOnLoad)
        {
            throw new InvalidOperationException("boom");
        }

        return _byUser.TryGetValue(userId, out var seen) ? new Dictionary<string, long>(seen) : null;
    }

    public void Save(string userId, Dictionary<string, long> seen)
    {
        if (ThrowOnSave)
        {
            throw new InvalidOperationException("boom");
        }

        SaveCount++;
        _byUser[userId] = new Dictionary<string, long>(seen);
    }

    // What a test can inspect: the stored map of a user (null if nothing was ever saved).
    public Dictionary<string, long>? Stored(string userId) => _byUser.TryGetValue(userId, out var seen) ? seen : null;
}
