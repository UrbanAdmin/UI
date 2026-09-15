using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Notificaciones;

public partial class NotificacionesPage : ContentPage
{
    private readonly NotificacionesViewModel _viewModel;

    public NotificacionesPage(NotificacionesViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

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
}
