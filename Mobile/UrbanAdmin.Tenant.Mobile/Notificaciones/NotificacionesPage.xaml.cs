using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Notificaciones;

// 013-tenant-pagos-alertas-redesign: the tenant Alertas screen. Every word, date and status key comes
// from AlertasViewModel / Core (unit-tested); this page only maps the cards onto the approved layout.
// AlertasViewModel also keeps the Alertas tab badge in sync after each load.
public partial class NotificacionesPage : ContentPage
{
    private readonly AlertasViewModel _viewModel;

    public NotificacionesPage(AlertasViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();
    }

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorPanel.IsVisible = false;
        EmptyPanel.IsVisible = false;
        CardsList.IsVisible = false;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (_viewModel.HasError)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorPanel.IsVisible = true;
        }
        else if (_viewModel.IsEmpty)
        {
            EmptyPanel.IsVisible = true;
        }
        else
        {
            BindableLayout.SetItemsSource(CardsList, _viewModel.Cards);
            CardsList.IsVisible = true;
        }
    }
}
