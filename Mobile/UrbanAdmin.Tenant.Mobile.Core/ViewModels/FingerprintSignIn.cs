using UrbanAdmin.Tenant.Mobile.Core.Services;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public enum FingerprintSignInOutcome
{
    Success,
    NoCredential,
    InvalidCredentials,
    ConnectionFailed,
}

public record FingerprintSignInResult(FingerprintSignInOutcome Outcome, string? Message);

// 015-fix-fingerprint-reopen FR-001/FR-004/FR-005: what happens after an accepted fingerprint on launch. It performs the real
// sign-in with the saved credential (so a fresh token exists before any screen loads data) and decides what becomes of the
// credential: kept on a connection failure or timeout (the user can try again), cleared when the server rejects it.
public class FingerprintSignIn(LoginViewModel login, IBiometricCredentialStore credentialStore)
{
    public async Task<FingerprintSignInResult> SignInAsync()
    {
        var credential = await credentialStore.GetCredentialAsync();
        if (credential is null)
        {
            return new FingerprintSignInResult(FingerprintSignInOutcome.NoCredential, null);
        }

        login.Username = credential.Value.Username;
        login.Password = credential.Value.Password;

        if (await login.LoginAsync())
        {
            return new FingerprintSignInResult(FingerprintSignInOutcome.Success, null);
        }

        if (login.LastFailure == LoginFailure.InvalidCredentials)
        {
            await credentialStore.ClearCredentialAsync();
            return new FingerprintSignInResult(FingerprintSignInOutcome.InvalidCredentials, login.ErrorMessage);
        }

        return new FingerprintSignInResult(FingerprintSignInOutcome.ConnectionFailed, login.ErrorMessage);
    }
}
