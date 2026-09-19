namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Wraps the platform's biometric sensor (010-logout-biometric-login) - real impl in the MAUI
// head project wraps Oscore.Maui.Biometric's IBiometricAuthentication (research.md §1), so
// AccountViewModel/LoginPage are testable without any MAUI runtime dependency.
public interface IBiometricAuthenticator
{
    // True only if the device has a biometric sensor AND at least one biometric is enrolled at
    // the OS level (FR-008) - never offered as a dead-end option.
    Task<bool> IsAvailableAsync();

    // Shows the platform's native biometric prompt with the given reason string. True only on a
    // genuine successful scan - cancellation, failure, or any error all return false (FR-007),
    // never throw for an expected "user said no" outcome.
    Task<bool> AuthenticateAsync(string reason);
}
