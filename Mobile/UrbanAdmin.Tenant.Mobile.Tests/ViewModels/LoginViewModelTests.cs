using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class LoginViewModelTests
{
    private static string MakeToken(string userId) =>
        // Mirrors the shape JwtClaimsReaderTests uses - only the payload segment matters.
        "header." + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($$"""{"sub":"{{userId}}"}""")).TrimEnd('=') + ".signature";

    [Fact]
    public async Task LoginAsync_SavesTheTokenOnSuccess()
    {
        var apiClient = new FakeTenantApiClient { TokenToReturn = MakeToken("42") };
        var tokenStore = new FakeTokenStore();
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new LoginViewModel(apiClient, tokenStore, diagnostics) { Username = "owner101", Password = "pw" };

        var success = await vm.LoginAsync();

        Assert.True(success);
        Assert.Equal(MakeToken("42"), await tokenStore.GetTokenAsync());
        Assert.Null(vm.ErrorMessage);
    }

    [Fact]
    public async Task LoginAsync_SetsAnErrorMessageOnInvalidCredentials()
    {
        var apiClient = new FakeTenantApiClient { TokenToReturn = null };
        var tokenStore = new FakeTokenStore();
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new LoginViewModel(apiClient, tokenStore, diagnostics) { Username = "owner101", Password = "wrong" };

        var success = await vm.LoginAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
        Assert.Null(await tokenStore.GetTokenAsync());
    }

    // US1 (FR-007): a successful login correlates future crash/diagnostic reports
    // with this tenant's internal id, decoded from the JWT's `sub` claim.
    [Fact]
    public async Task LoginAsync_SetsTheUserContextOnSuccess()
    {
        var apiClient = new FakeTenantApiClient { TokenToReturn = MakeToken("42") };
        var tokenStore = new FakeTokenStore();
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new LoginViewModel(apiClient, tokenStore, diagnostics) { Username = "owner101", Password = "pw" };

        await vm.LoginAsync();

        Assert.Equal("42", diagnostics.UserContext);
    }

    // US2 (FR-005): every login attempt is recorded, whether it succeeds or not.
    [Fact]
    public async Task LoginAsync_LogsTheLoginAttempt()
    {
        var apiClient = new FakeTenantApiClient { TokenToReturn = MakeToken("42") };
        var tokenStore = new FakeTokenStore();
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new LoginViewModel(apiClient, tokenStore, diagnostics) { Username = "owner101", Password = "pw" };

        await vm.LoginAsync();

        Assert.Equal(1, diagnostics.LoginAttemptCount);
    }

    // US2 (FR-005): invalid credentials are a distinguishable, non-sensitive
    // diagnostic reason - never the entered password.
    [Fact]
    public async Task LoginAsync_LogsInvalidCredentialsOnFailure()
    {
        var apiClient = new FakeTenantApiClient { TokenToReturn = null };
        var tokenStore = new FakeTokenStore();
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new LoginViewModel(apiClient, tokenStore, diagnostics) { Username = "owner101", Password = "wrong" };

        await vm.LoginAsync();

        Assert.Equal(["invalid-credentials"], diagnostics.LoginFailureReasons);
    }

    // US2 (FR-005) + research.md §6: today a network failure here propagates
    // uncaught - plausibly the exact mechanism behind the originally reported
    // "logs in but then closes like a crash" symptom. This is now caught,
    // logged, and surfaced as a normal error instead of crashing.
    [Fact]
    public async Task LoginAsync_CatchesAndLogsAnExceptionInsteadOfCrashing()
    {
        var apiClient = new FakeTenantApiClient { ThrowOnLogin = true };
        var tokenStore = new FakeTokenStore();
        var diagnostics = new FakeCrashDiagnosticsService();
        var vm = new LoginViewModel(apiClient, tokenStore, diagnostics) { Username = "owner101", Password = "pw" };

        var success = await vm.LoginAsync();

        Assert.False(success);
        Assert.NotNull(vm.ErrorMessage);
        Assert.Equal(["exception:HttpRequestException"], diagnostics.LoginFailureReasons);
    }

    // ---- 015-fix-fingerprint-reopen: failure kinds and the sign-in time limit --------------------------------------

    private static LoginViewModel Build(FakeTenantApiClient api, Func<TimeSpan, CancellationToken, Task>? delay = null) =>
        new(api, new FakeTokenStore(), new FakeCrashDiagnosticsService(), TimeSpan.FromSeconds(60), delay)
        {
            Username = "owner101",
            Password = "pw",
        };

    [Fact]
    public async Task LastFailure_IsNoneOnSuccess()
    {
        var vm = Build(new FakeTenantApiClient { TokenToReturn = MakeToken("42") });

        await vm.LoginAsync();

        Assert.Equal(LoginFailure.None, vm.LastFailure);
    }

    [Fact]
    public async Task LastFailure_IsInvalidCredentialsWhenTheServerRejectsThem()
    {
        var vm = Build(new FakeTenantApiClient { TokenToReturn = null });

        var success = await vm.LoginAsync();

        Assert.False(success);
        Assert.Equal(LoginFailure.InvalidCredentials, vm.LastFailure);
        Assert.Equal("Usuario o contraseña incorrectos", vm.ErrorMessage);
    }

    [Fact]
    public async Task LastFailure_IsConnectionWhenTheCallThrows()
    {
        var vm = Build(new FakeTenantApiClient { ThrowOnLogin = true });

        var success = await vm.LoginAsync();

        Assert.False(success);
        Assert.Equal(LoginFailure.Connection, vm.LastFailure);
        Assert.Equal("No se pudo iniciar sesión. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
    }

    [Fact]
    public async Task LoginAsync_WhenTheServerNeverAnswers_EndsAtTheTimeoutAsAConnectionFailure()
    {
        var api = new FakeTenantApiClient { LoginNeverCompletes = true };
        var vm = Build(api, delay: (_, _) => Task.CompletedTask);

        var success = await vm.LoginAsync();

        Assert.False(success);
        Assert.Equal(LoginFailure.Connection, vm.LastFailure);
        Assert.Equal("No se pudo iniciar sesión. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task LoginAsync_ASlowButAnsweringServerStillSucceeds()
    {
        var api = new FakeTenantApiClient { TokenToReturn = MakeToken("42"), LoginDelay = TimeSpan.FromMilliseconds(50) };
        var vm = Build(api);

        var success = await vm.LoginAsync();

        Assert.True(success);
        Assert.Equal(LoginFailure.None, vm.LastFailure);
    }

    [Fact]
    public async Task LastFailure_ResetsOnTheNextAttempt()
    {
        var api = new FakeTenantApiClient { ThrowOnLogin = true };
        var vm = Build(api);
        await vm.LoginAsync();

        api.ThrowOnLogin = false;
        api.TokenToReturn = MakeToken("42");
        await vm.LoginAsync();

        Assert.Equal(LoginFailure.None, vm.LastFailure);
        Assert.Null(vm.ErrorMessage);
    }
}
