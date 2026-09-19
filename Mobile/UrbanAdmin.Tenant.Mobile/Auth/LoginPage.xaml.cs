using UrbanAdmin.Tenant.Mobile.Account;
using UrbanAdmin.Tenant.Mobile.Core.Services;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Auth;

using AppShell = UrbanAdmin.Tenant.Mobile.AppShell;

public partial class LoginPage : ContentPage
{
    private readonly LoginViewModel _viewModel;
    private readonly AccountViewModel _accountViewModel;
    private readonly DeviceRegistrationService _deviceRegistration;
    private readonly ITokenStore _tokenStore;
    private readonly IBiometricCredentialStore _biometricCredentialStore;
    private readonly IBiometricAuthenticator _biometricAuthenticator;
    private bool _isFirstAppearance = true;

    public LoginPage(
        LoginViewModel viewModel,
        AccountViewModel accountViewModel,
        DeviceRegistrationService deviceRegistration,
        ITokenStore tokenStore,
        IBiometricCredentialStore biometricCredentialStore,
        IBiometricAuthenticator biometricAuthenticator)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _accountViewModel = accountViewModel;
        _deviceRegistration = deviceRegistration;
        _tokenStore = tokenStore;
        _biometricCredentialStore = biometricCredentialStore;
        _biometricAuthenticator = biometricAuthenticator;
    }

    // 010-logout-biometric-login FR-005/FR-008: on every launch after the very first (Shell
    // always starts at this route), attempt fingerprint sign-in before showing the form - only
    // if a credential was saved AND the device can actually prompt for a scan. A failed/
    // cancelled scan (or neither condition being true) falls through to the untouched form.
    protected override async void OnAppearing()
    {
        base.OnAppearing();

        if (!_isFirstAppearance)
        {
            return;
        }

        _isFirstAppearance = false;

        var credential = await _biometricCredentialStore.GetCredentialAsync();
        if (credential is null)
        {
            return;
        }

        if (!await _biometricAuthenticator.IsAvailableAsync())
        {
            return;
        }

        if (!await _biometricAuthenticator.AuthenticateAsync("Inicia sesión en UrbanAdmin"))
        {
            return;
        }

        _viewModel.Username = credential.Value.Username;
        _viewModel.Password = credential.Value.Password;
        await CompleteLoginAsync(offerFingerprintOptIn: false);
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

        await CompleteLoginAsync(offerFingerprintOptIn: true);
    }

    // Shared by both the manual-entry path (OnLoginClicked) and the fingerprint-triggered path
    // (OnAppearing) - one method for "what a successful login does", per research.md §3.
    private async Task CompleteLoginAsync(bool offerFingerprintOptIn)
    {
        Preferences.Default.Set(AccountConstants.LastUsernamePreferenceKey, _viewModel.Username);

        // Called on login (T027) - a missing/undelivered push token is not
        // an error (spec.md edge case), DeviceRegistrationService no-ops.
        var token = await _tokenStore.GetTokenAsync();
        if (token is not null)
        {
            await _deviceRegistration.RegisterCurrentDeviceAsync(token);
        }

        // 010-logout-biometric-login FR-004: offered only after a manual password login, on a
        // device that can actually take a scan, and only when not already enabled.
        if (offerFingerprintOptIn && await _biometricAuthenticator.IsAvailableAsync())
        {
            await _accountViewModel.LoadFingerprintStateAsync();
            if (!_accountViewModel.IsFingerprintEnabled)
            {
                var enable = await DisplayAlertAsync(
                    "Inicio de sesión con huella",
                    "¿Quieres usar tu huella para iniciar sesión la próxima vez?",
                    "Sí",
                    "No");
                if (enable)
                {
                    await _accountViewModel.EnableFingerprintSignInAsync(_viewModel.Username, _viewModel.Password);
                }
            }
        }

        // 008-mobile-admin-views T006: role-based navigation. "ApartmentOwner" (or an
        // unreadable/missing role, matching pre-existing behavior) goes to the tenant tabs
        // exactly as before this feature existed - spec.md FR-002.
        var role = token is not null ? JwtClaimsReader.GetRole(token) : null;
        if (Shell.Current is AppShell appShell)
        {
            appShell.ApplyRoleVisibility(role);
        }

        await Shell.Current.GoToAsync(role == "Admin" ? "//Apartments" : "//Notificaciones");
    }
}
