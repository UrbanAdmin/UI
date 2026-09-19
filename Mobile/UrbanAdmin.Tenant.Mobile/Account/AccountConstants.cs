namespace UrbanAdmin.Tenant.Mobile.Account;

// The JWT only carries userId/role (JwtClaimsReader), never the username - so LoginPage remembers
// the last-used username here (Preferences, not secure storage - a username isn't a secret, only
// the biometric credential's password half is) for AccountPage to prefill when enabling
// fingerprint sign-in (010-logout-biometric-login).
public static class AccountConstants
{
    public const string LastUsernamePreferenceKey = "last_username";
}
