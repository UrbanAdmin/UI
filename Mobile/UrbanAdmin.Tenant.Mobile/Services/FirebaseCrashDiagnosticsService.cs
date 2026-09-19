using System.Net;
using Plugin.Firebase.Crashlytics;
using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Services;

// Backed by the same real urbanadmin-tenant Firebase project already used for
// push notifications - no separate Crashlytics init call exists or is needed,
// it becomes available once CrossFirebase.Initialize(...) has run (already
// called in MainActivity.OnCreate / AppDelegate.FinishedLaunching for Cloud
// Messaging) - see research.md §5.
//
// IsSupported guards platforms with no Crashlytics native package (this app's
// Windows TargetFramework, used for local dev - research.md §5).
//
// RecordException always wraps a NEW, controlled Exception built only from
// this seam's own structured parameters, never the caller's original
// exception object - so a report can never end up carrying data this feature
// doesn't control (FR-006, research.md §5).
public class FirebaseCrashDiagnosticsService : ICrashDiagnosticsService
{
    public void SetUserContext(string userId)
    {
        if (!CrossFirebaseCrashlytics.IsSupported)
        {
            return;
        }

        CrossFirebaseCrashlytics.Current.SetUserId(userId);
    }

    public void LogLoginAttempt()
    {
        if (!CrossFirebaseCrashlytics.IsSupported)
        {
            return;
        }

        CrossFirebaseCrashlytics.Current.Log("login_attempt");
    }

    public void LogLoginFailure(string reason)
    {
        if (!CrossFirebaseCrashlytics.IsSupported)
        {
            return;
        }

        CrossFirebaseCrashlytics.Current.Log($"login_failure: {reason}");
        CrossFirebaseCrashlytics.Current.RecordException(new Exception($"Login failure: {reason}"));
    }

    public void LogApiError(string endpoint, int? statusCode)
    {
        if (!CrossFirebaseCrashlytics.IsSupported)
        {
            return;
        }

        // Includes the status code's reason phrase (e.g. "403 Forbidden") so a report is
        // immediately readable in the Firebase console without a device/logcat session to
        // decode what a bare number meant.
        var detail = statusCode is int code ? $"{endpoint} ({code} {(HttpStatusCode)code})" : endpoint;
        CrossFirebaseCrashlytics.Current.Log($"api_error: {detail}");
        CrossFirebaseCrashlytics.Current.RecordException(new Exception($"API error: {detail}"));
    }
}
