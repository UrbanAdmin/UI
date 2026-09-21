using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Notificaciones;

// 017-icon-only-tab-bar: the full list of alerts ("Ver todas las notificaciones"). It shares the Alertas view model
// (already loaded by the Alertas screen it was opened from), so a swipe here marks the alert read everywhere: the
// card turns flat in place and leaves the Alertas list.
public partial class TodasAlertasPage : ContentPage
{
    private readonly AlertasViewModel _viewModel;

    public TodasAlertasPage(AlertasViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        BindableLayout.SetItemsSource(CardsList, null);
        BindableLayout.SetItemsSource(CardsList, _viewModel.AllCards);
        EmptyLabel.IsVisible = _viewModel.AllCards.Count == 0;
        SwipeHint.IsVisible = _viewModel.AllCards.Count > 0;
    }

    private async void OnMarkReadRequested(object? sender, AlertCardRow card) => await _viewModel.MarkReadAsync(card);
}
