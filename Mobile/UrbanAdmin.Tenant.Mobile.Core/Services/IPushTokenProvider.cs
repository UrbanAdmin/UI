namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Platform-specific FCM token acquisition (real impl per platform in the
// MAUI head project's Platforms/Android and Platforms/iOS folders, using a
// Firebase client plugin - research.md §3). Returns null if the platform
// hasn't issued a token yet or the user declined the permission prompt
// (spec.md edge case: Notificaciones must still work from the ReminderLog
// history even when no push could ever be delivered).
public interface IPushTokenProvider
{
    Task<string?> GetTokenAsync();

    string Platform { get; }
}
