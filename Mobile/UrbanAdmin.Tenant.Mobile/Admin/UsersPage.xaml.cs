using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// Display-only row for the CollectionView - joins UserModel with the loaded apartments list
// to show the apartment number instead of a raw id, matching Angular's
// manage-users.component.ts (apartmentNumber()).
public record UserListRow(string Username, string RoleLabel, string ApartmentLabel, UserModel User);

// 008-mobile-admin-views T029: US3 - list of every user, matching the web app's Manage Users
// screen. Same imperative code-behind pattern as ApartmentsPage.
public partial class UsersPage : ContentPage
{
    private readonly UsersViewModel _viewModel;

    public UsersPage(UsersViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();
    }

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ItemsList.IsVisible = false;
        EmptyLabel.IsVisible = false;
        ErrorLabel.IsVisible = false;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (_viewModel.HasError)
        {
            ErrorLabel.IsVisible = true;
        }
        else if (_viewModel.IsEmpty)
        {
            EmptyLabel.IsVisible = true;
        }
        else
        {
            ItemsList.ItemsSource = _viewModel.Items.Select(ToRow).ToList();
            ItemsList.IsVisible = true;
        }
    }

    private UserListRow ToRow(UserModel user)
    {
        var roleLabel = user.Role == "Admin" ? "Administrador" : "Arrendatario";
        var apartmentLabel = user.ApartmentId is long apartmentId
            ? _viewModel.Apartments.FirstOrDefault(a => a.Id == apartmentId)?.Name ?? "—"
            : "—";
        return new UserListRow(user.Username, roleLabel, apartmentLabel, user);
    }

    private async void OnAddClicked(object? sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("UserEdit");
    }

    private async void OnUserSelected(object? sender, SelectionChangedEventArgs e)
    {
        ItemsList.SelectedItem = null;
        if (e.CurrentSelection.FirstOrDefault() is not UserListRow row)
        {
            return;
        }

        await Shell.Current.GoToAsync("UserEdit", new Dictionary<string, object>
        {
            ["User"] = row.User,
        });
    }
}
