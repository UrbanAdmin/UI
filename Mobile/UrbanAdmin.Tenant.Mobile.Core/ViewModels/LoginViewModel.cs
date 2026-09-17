using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public class LoginViewModel(ITenantApiClient apiClient, ITokenStore tokenStore, ICrashDiagnosticsService diagnostics)
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? ErrorMessage { get; private set; }
    public bool IsBusy { get; private set; }

    public async Task<bool> LoginAsync()
    {
        IsBusy = true;
        ErrorMessage = null;
        diagnostics.LogLoginAttempt();
        try
        {
            string? token;
            try
            {
                token = await apiClient.LoginAsync(Username, Password);
            }
            catch (Exception ex)
            {
                // US2/FR-005 + research.md §6: previously this exception propagated
                // uncaught (plausibly the originally reported crash-after-login
                // symptom) - now it's caught, logged, and surfaced as a normal error.
                diagnostics.LogLoginFailure($"exception:{ex.GetType().Name}");
                ErrorMessage = "No se pudo iniciar sesión. Verifica tu conexión e intenta de nuevo.";
                return false;
            }

            if (token is null)
            {
                diagnostics.LogLoginFailure("invalid-credentials");
                ErrorMessage = "Usuario o contraseña incorrectos";
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
}
