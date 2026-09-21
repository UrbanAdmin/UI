namespace UrbanAdmin.Tenant.Mobile.Core.Navigation;

// 014-admin-pagos-first-tab FR-003: where the app opens after sign-in or a restored session. Administrators
// land on the Pagos tab (first admin tab); everyone else keeps the tenant Pagos tab.
public static class AdminLanding
{
    public static string RouteFor(string? role) => role == "Admin" ? "//AdminPagosHome" : "//Pagos";
}
