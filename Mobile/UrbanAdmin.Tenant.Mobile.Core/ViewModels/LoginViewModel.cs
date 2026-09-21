using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public enum LoginFailure
{
    None,
    Connection,
    InvalidCredentials,
}

// 015-fix-fingerprint-reopen: LastFailure tells "the server said no" from "the server did not answer", and the sign-in
// itself now ends after the sign-in timeout (60 s) so a sleeping server can never leave the screen waiting forever.
// The timeout and the delay are injectable so the behavior is unit-tested.
public class LoginViewModel(
    ITenantApiClient apiClient,
    ITokenStore tokenStore,
    ICrashDiagnosticsService diagnostics,
    TimeSpan? signInTimeout = null,
    Func<TimeSpan, CancellationToken, Task>? delay = null)
{
    public const string ConnectionMessage = "No se pudo iniciar sesión. Verifica tu conexión e intenta de nuevo.";
    public const string InvalidCredentialsMessage = "Usuario o contraseña incorrectos";

    private readonly TimeSpan _signInTimeout = signInTimeout ?? TimeSpan.FromSeconds(60);
    private readonly Func<TimeSpan, CancellationToken, Task> _delay = delay ?? Task.Delay;

    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? ErrorMessage { get; private set; }
    public bool IsBusy { get; private set; }
    public LoginFailure LastFailure { get; private set; }

    public async Task<bool> LoginAsync()
    {
        IsBusy = true;
        ErrorMessage = null;
        LastFailure = LoginFailure.None;
        diagnostics.LogLoginAttempt();
        try
        {
            string? token;
            try
            {
                token = await LoginWithTimeoutAsync();
            }
            catch (TimeoutException)
            {
                diagnostics.LogLoginFailure("timeout");
                LastFailure = LoginFailure.Connection;
                ErrorMessage = ConnectionMessage;
                return false;
            }
            catch (Exception ex)
            {
                // US2/FR-005 + research.md §6: previously this exception propagated
                // uncaught (plausibly the originally reported crash-after-login
                // symptom) - now it's caught, logged, and surfaced as a normal error.
                diagnostics.LogLoginFailure($"exception:{ex.GetType().Name}");
                LastFailure = LoginFailure.Connection;
                ErrorMessage = ConnectionMessage;
                return false;
            }

            if (token is null)
            {
                diagnostics.LogLoginFailure("invalid-credentials");
                LastFailure = LoginFailure.InvalidCredentials;
                ErrorMessage = InvalidCredentialsMessage;
                return false;
            }

            var userId = JwtClaimsReader.GetUserId(token);
            if (userId is not null)
            {
                diagnostics.SetUserContext(userId);
            }

            await tokenStore.SaveTokenAsync(token);
            return true;
        }
        finally
        {
            IsBusy = false;
        }
    }

    // The login races a timer; whichever finishes first decides. A losing login is left to finish on its own and its
    // outcome is observed, so a late failure is never an unobserved exception.
    private async Task<string?> LoginWithTimeoutAsync()
    {
        using var cts = new CancellationTokenSource();
        var login = apiClient.LoginAsync(Username, Password);
        var timer = _delay(_signInTimeout, cts.Token);

        var finished = await Task.WhenAny(login, timer);
        if (finished != login)
        {
            _ = login.ContinueWith(t => _ = t.Exception, TaskContinuationOptions.OnlyOnFaulted);
            throw new TimeoutException();
        }

        cts.Cancel();
        return await login;
    }
}
