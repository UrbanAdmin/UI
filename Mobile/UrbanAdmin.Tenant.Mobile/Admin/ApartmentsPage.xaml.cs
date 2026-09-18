using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// 008-mobile-admin-views T017: US2 - list of every apartment, matching the web app's Manage
// Apartments screen. Same imperative code-behind pattern as NotificacionesPage/PagosPage
// (no data-binding beyond the CollectionView's own item templates).
public partial class ApartmentsPage : ContentPage
{
    private readonly ApartmentsViewModel _viewModel;

    public ApartmentsPage(ApartmentsViewModel viewModel)
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
            ItemsList.ItemsSource = _viewModel.Items;
            ItemsList.IsVisible = true;
        }
    }

    private async void OnAddClicked(object? sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("ApartmentEdit");
    }

    private async void OnApartmentSelected(object? sender, SelectionChangedEventArgs e)
    {
        ItemsList.SelectedItem = null;
        if (e.CurrentSelection.FirstOrDefault() is not ApartmentModel apartment)
        {
            return;
        }

        await Shell.Current.GoToAsync("ApartmentEdit", new Dictionary<string, object>
        {
            ["Apartment"] = apartment,
        });
    }
}
