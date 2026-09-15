using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Pagos;

public partial class PagosPage : ContentPage
{
    private readonly PagosViewModel _viewModel;

    public PagosPage(PagosViewModel viewModel)
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
