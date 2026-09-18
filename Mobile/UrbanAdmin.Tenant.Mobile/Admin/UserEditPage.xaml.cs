using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// 008-mobile-admin-views T030: create/edit form for a single user, matching Angular's
// user-dialog.component.ts (role labels, apartment picker showing every apartment, password
// field relabeled on edit - research.md §9).
[QueryProperty(nameof(User), "User")]
public partial class UserEditPage : ContentPage
{
    private static readonly string[] RoleValues = ["Admin", "ApartmentOwner"];

    private readonly UserEditViewModel _viewModel;
    private List<ApartmentModel> _apartments = [];
    private UserModel? _pendingUser;

    public UserEditPage(UserEditViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        RolePicker.SelectedIndex = 0;
    }

    // Set by Shell navigation's query parameter (UsersPage.OnUserSelected) when editing; stays
    // null when navigated to via "Agregar" (create mode).
    public UserModel? User
    {
        set
        {
            if (value is null)
            {
                return;
            }

            _pendingUser = value;
            _viewModel.UserId = value.Id;
            UsernameEntry.Text = value.Username;
            UsernameEntry.IsEnabled = false;
            PasswordEntry.Placeholder = "Nueva contraseña (opcional)";
            PasswordHintLabel.IsVisible = true;
            DeleteButton.IsVisible = true;
        }
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        await _viewModel.LoadApartmentsAsync();
        _apartments = _viewModel.Apartments;
        ApartmentPicker.ItemsSource = _apartments.Select(a => a.Name).ToList();

        if (_pendingUser is { } user)
        {
            RolePicker.SelectedIndex = Array.IndexOf(RoleValues, user.Role);
            if (user.ApartmentId is long apartmentId)
            {
                var index = _apartments.FindIndex(a => a.Id == apartmentId);
                if (index >= 0)
                {
                    ApartmentPicker.SelectedIndex = index;
                }
            }
        }

        UpdateApartmentPickerVisibility();
    }

    private void OnRoleChanged(object? sender, EventArgs e) => UpdateApartmentPickerVisibility();

    private void UpdateApartmentPickerVisibility()
    {
        ApartmentPicker.IsVisible = RolePicker.SelectedIndex == 1;
    }

    private async void OnSaveClicked(object? sender, EventArgs e)
    {
        _viewModel.Username = UsernameEntry.Text ?? string.Empty;
        _viewModel.Role = RolePicker.SelectedIndex >= 0 ? RoleValues[RolePicker.SelectedIndex] : string.Empty;

        if (_viewModel.UserId is null)
        {
            _viewModel.Password = PasswordEntry.Text ?? string.Empty;
        }
        else
        {
            _viewModel.NewPassword = PasswordEntry.Text;
        }

        _viewModel.ApartmentId = ApartmentPicker.SelectedIndex >= 0 && ApartmentPicker.SelectedIndex < _apartments.Count
            ? _apartments[ApartmentPicker.SelectedIndex].Id
            : null;

        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorLabel.IsVisible = false;

        var success = await _viewModel.SaveAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
            return;
        }

        await Shell.Current.GoToAsync("..");
    }

    private async void OnDeleteClicked(object? sender, EventArgs e)
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorLabel.IsVisible = false;

        var success = await _viewModel.DeleteAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (!success)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
            return;
        }

        await Shell.Current.GoToAsync("..");
    }
}
