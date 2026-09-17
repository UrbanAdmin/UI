using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

public class FakeCrashDiagnosticsService : ICrashDiagnosticsService
{
    public string? UserContext { get; private set; }
    public int LoginAttemptCount { get; private set; }
    public List<string> LoginFailureReasons { get; } = [];
    public List<(string Endpoint, int? StatusCode)> ApiErrors { get; } = [];

    public void SetUserContext(string userId) => UserContext = userId;

    public void LogLoginAttempt() => LoginAttemptCount++;

    public void LogLoginFailure(string reason) => LoginFailureReasons.Add(reason);

    public void LogApiError(string endpoint, int? statusCode) => ApiErrors.Add((endpoint, statusCode));
}
