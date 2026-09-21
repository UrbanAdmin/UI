using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 015-fix-fingerprint-reopen FR-001/FR-004/FR-005: after an accepted fingerprint the app signs in for real with the saved
// credential; a rejected credential is cleared, a connection failure keeps it.
public class FingerprintSignInTests
{
    private const string Token = "header.eyJzdWIiOiI0MiJ9.signature";

    private static async Task<(FingerprintSignIn Sut, FakeTenantApiClient Api, FakeTokenStore Tokens, FakeBiometricCredentialStore Credentials)> MakeAsync(
        bool saved = true, Func<TimeSpan, CancellationToken, Task>? delay = null)
    {
        var api = new FakeTenantApiClient { TokenToReturn = Token };
        var tokens = new FakeTokenStore();
        var credentials = new FakeBiometricCredentialStore();
        if (saved)
        {
            await credentials.SaveCredentialAsync("owner101", "pw");
        }

        var login = new LoginViewModel(api, tokens, new FakeCrashDiagnosticsService(), TimeSpan.FromSeconds(60), delay);
        return (new FingerprintSignIn(login, credentials), api, tokens, credentials);
    }

    [Fact]
    public async Task ASuccessfulSignIn_SavesAFreshTokenAndKeepsTheCredential()
    {
        var (sut, api, tokens, credentials) = await MakeAsync();

        var result = await sut.SignInAsync();

        Assert.Equal(FingerprintSignInOutcome.Success, result.Outcome);
        Assert.Null(result.Message);
        Assert.Equal(Token, await tokens.GetTokenAsync());
        Assert.NotNull(await credentials.GetCredentialAsync());
        Assert.Equal(("owner101", "pw"), api.LastLogin);
    }

    [Fact]
    public async Task ARejectedCredential_IsClearedAndTheFormShowsTheWrongPasswordMessage()
    {
        var (sut, api, tokens, credentials) = await MakeAsync();
        api.TokenToReturn = null;

        var result = await sut.SignInAsync();

        Assert.Equal(FingerprintSignInOutcome.InvalidCredentials, result.Outcome);
        Assert.Equal("Usuario o contraseña incorrectos", result.Message);
        Assert.Null(await credentials.GetCredentialAsync());
        Assert.Null(await tokens.GetTokenAsync());
    }

    [Fact]
    public async Task AConnectionFailure_KeepsTheCredentialAndSaysSo()
    {
        var (sut, api, _, credentials) = await MakeAsync();
        api.ThrowOnLogin = true;

        var result = await sut.SignInAsync();

        Assert.Equal(FingerprintSignInOutcome.ConnectionFailed, result.Outcome);
        Assert.Equal("No se pudo iniciar sesión. Verifica tu conexión e intenta de nuevo.", result.Message);
        Assert.NotNull(await credentials.GetCredentialAsync());
    }

    [Fact]
    public async Task ATimeout_IsAConnectionFailureAndKeepsTheCredential()
    {
        var (sut, api, _, credentials) = await MakeAsync(delay: (_, _) => Task.CompletedTask);
        api.LoginNeverCompletes = true;

        var result = await sut.SignInAsync();

        Assert.Equal(FingerprintSignInOutcome.ConnectionFailed, result.Outcome);
        Assert.NotNull(await credentials.GetCredentialAsync());
    }

    [Fact]
    public async Task WithoutASavedCredential_NothingIsCalled()
    {
        var (sut, api, _, _) = await MakeAsync(saved: false);

        var result = await sut.SignInAsync();

        Assert.Equal(FingerprintSignInOutcome.NoCredential, result.Outcome);
        Assert.Null(api.LastLogin);
    }
}
