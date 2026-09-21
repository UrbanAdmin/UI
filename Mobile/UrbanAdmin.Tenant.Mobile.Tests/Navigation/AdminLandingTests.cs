using UrbanAdmin.Tenant.Mobile.Core.Navigation;

namespace UrbanAdmin.Tenant.Mobile.Tests.Navigation;

// 014-admin-pagos-first-tab FR-003: administrators land on the Pagos tab, everyone else on the tenant Pagos.
public class AdminLandingTests
{
    [Fact]
    public void RouteFor_Admin_IsTheAdminPagosTab() =>
        Assert.Equal("//AdminPagosHome", AdminLanding.RouteFor("Admin"));

    [Theory]
    [InlineData("ApartmentOwner")]
    [InlineData("")]
    [InlineData("SomethingElse")]
    [InlineData(null)]
    public void RouteFor_AnyOtherRole_IsTheTenantPagosTab(string? role) =>
        Assert.Equal("//Pagos", AdminLanding.RouteFor(role));
}
