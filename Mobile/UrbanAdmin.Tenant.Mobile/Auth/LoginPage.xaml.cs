using UrbanAdmin.Tenant.Mobile.Account;
using UrbanAdmin.Tenant.Mobile.Core.Navigation;
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
    private readonly FingerprintSignIn _fingerprintSignIn;
    private readonly SlowSignInHint _slowHint;
    private bool _isFirstAppearance = true;
    private bool _isSigningIn;

    public LoginPage(
        LoginViewModel viewModel,
        AccountViewModel accountViewModel,
        DeviceRegistrationService deviceRegistration,
        ITokenStore tokenStore,
        IBiometricCredentialStore biometricCredentialStore,
        IBiometricAuthenticator biometricAuthenticator,
        FingerprintSignIn fingerprintSignIn,
        SlowSignInHint slowHint)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _accountViewModel = accountViewModel;
        _deviceRegistration = deviceRegistration;
        _tokenStore = tokenStore;
        _biometricCredentialStore = biometricCredentialStore;
        _biometricAuthenticator = biometricAuthenticator;
        _fingerprintSignIn = fingerprintSignIn;
        _slowHint = slowHint;

        // 015-fix-fingerprint-reopen FR-008: after 5 s of waiting the busy indicator gains a reassuring line.
        SlowHintLabel.Text = SlowSignInHint.Message;
        _slowHint.Changed += () => MainThread.BeginInvokeOnMainThread(() => SlowHintLabel.IsVisible = _slowHint.IsVisible && _isSigningIn);
    }

    // 010-logout-biometric-login FR-005/FR-008: on every launch after the very first (Shell
    // always starts at this route), attempt fingerprint sign-in before showing the form - only
    // if a credential was saved AND the device can actually prompt for a scan. A failed/
    // cancelled scan (or neither condition being true) falls through to the untouched form.
    //
    // 015-fix-fingerprint-reopen: after an accepted scan the app now performs a REAL sign-in with the saved credential
    // (FingerprintSignIn) - before, it went straight to the first screen without ever requesting a token, so the screens
    // loaded with no or an expired session - and shows the busy indicator throughout, with the failure kinds handled.
    protected override async void OnAppearing()
    {
        base.OnAppearing();

        if (!_isFirstAppearance || _isSigningIn)
        {
            return;
        }

        _isFirstAppearance = false;

        var credential = await _biometricCredentialStore.GetCredentialAsync();
        if (credential is null)
        {
            return;
        }

        SetBusy(true);
        try
        {
            if (!await _biometricAuthenticator.IsAvailableAsync()
                || !await _biometricAuthenticator.AuthenticateAsync("Inicia sesión en UrbanAdmin"))
            {
                return;
            }

            var result = await _fingerprintSignIn.SignInAsync();
            switch (result.Outcome)
            {
                case FingerprintSignInOutcome.Success:
                    _viewModel.Username = credential.Value.Username;
                    _viewModel.Password = credential.Value.Password;
                    await CompleteLoginAsync(offerFingerprintOptIn: false);
                    break;
                case FingerprintSignInOutcome.InvalidCredentials:
                case FingerprintSignInOutcome.ConnectionFailed:
                    ShowError(result.Message);
                    break;
            }
        }
        finally
        {
            SetBusy(false);
        }
    }

    private async void OnLoginClicked(object? sender, EventArgs e)
    {
        if (_isSigningIn)
        {
            return;
        }

        _viewModel.Username = UsernameEntry.Text ?? string.Empty;
        _viewModel.Password = PasswordEntry.Text ?? string.Empty;

        ErrorLabel.IsVisible = false;
        SetBusy(true);
        bool success;
        try
        {
            success = await _viewModel.LoginAsync();
        }
        finally
        {
            SetBusy(false);
        }

        if (!success)
        {
            ShowError(_viewModel.ErrorMessage);
            return;
        }

        await CompleteLoginAsync(offerFingerprintOptIn: true);
    }

    // One busy state for both sign-in paths (015 FR-002): the indicator, the slow-server line, a disabled form and the
    // guard against a second sign-in. Always undone in a finally by the callers.
    private void SetBusy(bool busy)
    {
        _isSigningIn = busy;
        BusyIndicator.IsVisible = busy;
        BusyIndicator.IsRunning = busy;
        LoginButton.IsEnabled = !busy;
        UsernameEntry.IsEnabled = !busy;
        PasswordEntry.IsEnabled = !busy;

        if (busy)
        {
            ErrorLabel.IsVisible = false;
            _slowHint.Start();
        }
        else
        {
            _slowHint.Stop();
            SlowHintLabel.IsVisible = false;
        }
    }

    private void ShowError(string? message)
    {
        ErrorLabel.Text = message;
        ErrorLabel.IsVisible = !string.IsNullOrEmpty(message);
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

        await Shell.Current.GoToAsync(AdminLanding.RouteFor(role));
    }
}
