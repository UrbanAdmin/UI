namespace UrbanAdmin.Tenant.Mobile;

public static class AppConfig
{
    // The real deployed Backend (Render). Never a plaintext credential, so this
    // is safe to commit, unlike the Firebase server key (Constitution Principle I).
    public const string BackendBaseUrl = "https://urbanadmin-api.onrender.com";
}
