using UrbanAdmin.Tenant.Mobile.Admin;

namespace UrbanAdmin.Tenant.Mobile;

public partial class AppShell : Shell
{
	public AppShell()
	{
		InitializeComponent();

		// Not part of the TabBar/visual tree, so needs an explicit route registration -
		// 008-mobile-admin-views T019.
		Routing.RegisterRoute("ApartmentEdit", typeof(ApartmentEditPage));
		Routing.RegisterRoute("UserEdit", typeof(UserEditPage));
	}

	// 008-mobile-admin-views T005: called from LoginPage right after a successful login.
	// Today's tenant behavior for role == "ApartmentOwner" is preserved exactly (only the
	// tenant tabs were ever visible before this feature existed) - spec.md FR-002.
	public void ApplyRoleVisibility(string? role)
	{
		var isAdmin = role == "Admin";

		NotificacionesTab.IsVisible = !isAdmin;
		PagosTab.IsVisible = !isAdmin;

		ApartmentsTab.IsVisible = isAdmin;
		UsersTab.IsVisible = isAdmin;
		AdminPagosTab.IsVisible = isAdmin;
		AdminNotificacionesTab.IsVisible = isAdmin;
	}
}
