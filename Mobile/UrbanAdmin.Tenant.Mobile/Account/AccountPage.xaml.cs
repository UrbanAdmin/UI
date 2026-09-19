using UrbanAdmin.Tenant.Mobile.Core.Services;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Account;

// Backs the shared "Cuenta" tab (010-logout-biometric-login) - the app's first screen visible to
// both roles. Confirmed against Mockups/cuenta-account-screen/index.html before implementation
// (Constitution Principle XI).
public partial class AccountPage : ContentPage
{
    private readonly AccountViewModel _viewModel;
    private readonly IBiometricAuthenticator _biometricAuthenticator;
    private bool _isInitializingSwitch;

    public AccountPage(AccountViewModel viewModel, IBiometricAuthenticator biometricAuthenticator)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _biometricAuthenticator = biometricAuthenticator;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        var available = await _biometricAuthenticator.IsAvailableAsync();
        if (!available)
        {
            // FR-008: never offered as a dead-end option.
            FingerprintSwitch.IsEnabled = false;
            UnavailableNoteLabel.IsVisible = true;
            return;
        }

        await _viewModel.LoadFingerprintStateAsync();

        _isInitializingSwitch = true;
        FingerprintSwitch.IsToggled = _viewModel.IsFingerprintEnabled;
        _isInitializingSwitch = false;
    }

    private void OnFingerprintToggled(object? sender, ToggledEventArgs e)
    {
        if (_isInitializingSwitch)
        {
            return;
        }

        if (e.Value)
        {
            ConfirmPanel.IsVisible = true;
            ConfirmErrorLabel.IsVisible = false;
        }
        else
        {
            // Disabling needs no confirmation - immediate, per the confirmed mockup.
            _ = DisableAsync();
        }
    }

    private async Task DisableAsync()
    {
        await _viewModel.DisableFingerprintSignInAsync();
    }

    private void OnCancelEnableClicked(object? sender, EventArgs e)
    {
        ConfirmPasswordEntry.Text = string.Empty;
        ConfirmPanel.IsVisible = false;
        _isInitializingSwitch = true;
        FingerprintSwitch.IsToggled = false;
        _isInitializingSwitch = false;
    }

    private async void OnConfirmEnableClicked(object? sender, EventArgs e)
    {
        var password = ConfirmPasswordEntry.Text ?? string.Empty;
        if (string.IsNullOrEmpty(password))
        {
            ConfirmErrorLabel.Text = "Ingresa tu contraseña.";
            ConfirmErrorLabel.IsVisible = true;
            return;
        }

        var username = Preferences.Default.Get(AccountConstants.LastUsernamePreferenceKey, string.Empty);
        var success = await _viewModel.EnableFingerprintSignInAsync(username, password);

        ConfirmPasswordEntry.Text = string.Empty;

        if (!success)
        {
            ConfirmErrorLabel.Text = "No se pudo activar. Intenta de nuevo.";
            ConfirmErrorLabel.IsVisible = true;
            return;
        }

        ConfirmPanel.IsVisible = false;
    }

    private async void OnLogoutTapped(object? sender, EventArgs e)
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;

        await _viewModel.LogoutAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        await Shell.Current.GoToAsync("//Login");
    }
}
