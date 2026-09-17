namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// A small, fixed set of structured methods rather than one free-form Log(string)
// method - a call site can only ever pass the specific non-sensitive fields these
// signatures accept, so there is no code path where a raw password or full
// request/response body could end up in a crash/diagnostic report by accident
// (FR-006, research.md §3).
public interface ICrashDiagnosticsService
{
    // Associates subsequent crash/diagnostic reports with this tenant's internal
    // id (FR-007) - call once, right after a successful login.
    void SetUserContext(string userId);

    void LogLoginAttempt();

    // reason is a short, non-sensitive technical classification (e.g.
    // "invalid-credentials" or "exception:HttpRequestException") - never the
    // entered password.
    void LogLoginFailure(string reason);

    void LogApiError(string endpoint, int? statusCode);
}
