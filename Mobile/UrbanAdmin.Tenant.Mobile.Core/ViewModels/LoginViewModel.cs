using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public class LoginViewModel(ITenantApiClient apiClient, ITokenStore tokenStore)
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? ErrorMessage { get; private set; }
    public bool IsBusy { get; private set; }

    public async Task<bool> LoginAsync()
    {
        IsBusy = true;
        ErrorMessage = null;
        try
        {
            var token = await apiClient.LoginAsync(Username, Password);
            if (token is null)
            {
                ErrorMessage = "Usuario o contraseña incorrectos";
                return false;
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
