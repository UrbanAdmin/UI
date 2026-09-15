using UrbanAdmin.Tenant.Mobile.Core.Services;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Auth;

public partial class LoginPage : ContentPage
{
    private readonly LoginViewModel _viewModel;
    private readonly DeviceRegistrationService _deviceRegistration;
    private readonly ITokenStore _tokenStore;

    public LoginPage(LoginViewModel viewModel, DeviceRegistrationService deviceRegistration, ITokenStore tokenStore)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _deviceRegistration = deviceRegistration;
        _tokenStore = tokenStore;
    }

    private async void OnLoginClicked(object? sender, EventArgs e)
    {
        _viewModel.Username = UsernameEntry.Text ?? string.Empty;
        _viewModel.Password = PasswordEntry.Text ?? string.Empty;

        LoginButton.IsEnabled = false;
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorLabel.IsVisible = false;

        var success = await _viewModel.LoginAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;
        LoginButton.IsEnabled = true;

        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
            return;
        }

        // Called on login (T027) - a missing/undelivered push token is not
        // an error (spec.md edge case), DeviceRegistrationService no-ops.
        var token = await _tokenStore.GetTokenAsync();
        if (token is not null)
        {
            await _deviceRegistration.RegisterCurrentDeviceAsync(token);
        }

        await Shell.Current.GoToAsync("//Notificaciones");
    }
}
