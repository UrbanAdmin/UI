namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Extracts only a structured HTTP status code from a caught exception for
// ICrashDiagnosticsService.LogApiError - never the exception's message or stack trace, which
// could carry sensitive data (ICrashDiagnosticsService's own design intent, FR-006 from
// 005-mobile-observability). This is the one place every ViewModel's catch block should get
// this value from, instead of always passing null.
public static class HttpExceptionExtensions
{
    public static int? ToApiStatusCode(this Exception ex) =>
        ex is HttpRequestException { StatusCode: { } code } ? (int)code : null;
}
