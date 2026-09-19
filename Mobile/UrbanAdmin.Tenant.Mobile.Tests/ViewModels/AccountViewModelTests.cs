using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

public class AccountViewModelTests
{
    [Fact]
    public async Task LogoutAsync_ClearsTheSessionToken()
    {
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var biometricStore = new FakeBiometricCredentialStore();
        var vm = new AccountViewModel(tokenStore, biometricStore);

        await vm.LogoutAsync();

        Assert.Null(await tokenStore.GetTokenAsync());
    }

    // FR-003/SC-004: logging out is a full end to the device's signed-in state, not just the
    // session token - a lost/borrowed device must never still be able to sign back in via a
    // leftover fingerprint credential after a logout.
    [Fact]
    public async Task LogoutAsync_AlsoClearsTheBiometricCredential()
    {
        var tokenStore = new FakeTokenStore();
        var biometricStore = new FakeBiometricCredentialStore();
        await biometricStore.SaveCredentialAsync("ana", "hunter2");
        var vm = new AccountViewModel(tokenStore, biometricStore);

        await vm.LogoutAsync();

        Assert.Null(await biometricStore.GetCredentialAsync());
    }

    [Fact]
    public async Task LogoutAsync_ClearingTheBiometricCredentialIsANoOpWhenNoneWasEverStored()
    {
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var biometricStore = new FakeBiometricCredentialStore();
        var vm = new AccountViewModel(tokenStore, biometricStore);

        await vm.LogoutAsync();

        Assert.Null(await tokenStore.GetTokenAsync());
        Assert.Null(await biometricStore.GetCredentialAsync());
    }

    [Fact]
    public async Task IsFingerprintEnabled_IsFalseWhenNoCredentialIsStored()
    {
        var vm = new AccountViewModel(new FakeTokenStore(), new FakeBiometricCredentialStore());

        await vm.LoadFingerprintStateAsync();

        Assert.False(vm.IsFingerprintEnabled);
    }

    [Fact]
    public async Task IsFingerprintEnabled_IsTrueWhenACredentialIsStored()
    {
        var biometricStore = new FakeBiometricCredentialStore();
        await biometricStore.SaveCredentialAsync("ana", "hunter2");
        var vm = new AccountViewModel(new FakeTokenStore(), biometricStore);

        await vm.LoadFingerprintStateAsync();

        Assert.True(vm.IsFingerprintEnabled);
    }

    [Fact]
    public async Task EnableFingerprintSignInAsync_SavesTheCredentialAndUpdatesState()
    {
        var biometricStore = new FakeBiometricCredentialStore();
        var vm = new AccountViewModel(new FakeTokenStore(), biometricStore);

        var success = await vm.EnableFingerprintSignInAsync("ana", "hunter2");

        Assert.True(success);
        Assert.True(vm.IsFingerprintEnabled);
        Assert.Equal(("ana", "hunter2"), await biometricStore.GetCredentialAsync());
    }

    // FR-009: disabling fingerprint sign-in is independent of logging out - the session token
    // (if any) must be left untouched.
    [Fact]
    public async Task DisableFingerprintSignInAsync_ClearsOnlyTheCredentialNotTheSessionToken()
    {
        var tokenStore = new FakeTokenStore();
        await tokenStore.SaveTokenAsync("fake-jwt");
        var biometricStore = new FakeBiometricCredentialStore();
        await biometricStore.SaveCredentialAsync("ana", "hunter2");
        var vm = new AccountViewModel(tokenStore, biometricStore);
        await vm.LoadFingerprintStateAsync();

        await vm.DisableFingerprintSignInAsync();

        Assert.False(vm.IsFingerprintEnabled);
        Assert.Null(await biometricStore.GetCredentialAsync());
        Assert.Equal("fake-jwt", await tokenStore.GetTokenAsync());
    }
}
