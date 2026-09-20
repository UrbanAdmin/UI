using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Pagos;

// 013-tenant-pagos-alertas-redesign: all wording, dates, totals and status keys come from
// PagosViewModel / Core (unit-tested); this page only maps them onto the approved layout. It stays
// strictly read-only (FR-008) - the only gestures are the month arrows and the header logout.
public partial class PagosPage : ContentPage
{
    private readonly PagosViewModel _viewModel;
    private readonly AlertsBadgeService _badgeService;

    public PagosPage(PagosViewModel viewModel, AlertsBadgeService badgeService)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _badgeService = badgeService;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();

        // Keeps the Alertas tab badge fresh even if the tenant has not opened Alertas yet.
        await _badgeService.RefreshAsync();
    }

    private async void OnPreviousTapped(object? sender, TappedEventArgs e)
    {
        if (_viewModel.Navigator.Previous())
        {
            await ReloadAsync();
        }
    }

    private async void OnNextTapped(object? sender, TappedEventArgs e)
    {
        if (_viewModel.Navigator.Next())
        {
            await ReloadAsync();
        }
    }

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorPanel.IsVisible = false;
        ContentPanel.IsVisible = false;
        RenderNavigator();

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;
        RenderState();
    }

    private void RenderNavigator()
    {
        MonthLabel.Text = _viewModel.MonthLabel;

        // At either end of the reachable range the arrow dims instead of doing nothing silently.
        PreviousButton.Opacity = _viewModel.Navigator.CanGoPrevious ? 1 : 0.35;
        NextButton.Opacity = _viewModel.Navigator.CanGoNext ? 1 : 0.35;
    }

    private void RenderState()
    {
        Header.Kicker = _viewModel.HeaderKicker;
        RenderNavigator();

        if (_viewModel.HasError)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorPanel.IsVisible = true;
            ContentPanel.IsVisible = false;
            return;
        }

        ErrorPanel.IsVisible = false;
        ContentPanel.IsVisible = true;

        TotalLabel.Text = _viewModel.PendingTotalDisplay;
        HintLabel.Text = _viewModel.SummaryHint;
        EmptyPanel.IsVisible = _viewModel.IsEmpty;
        BindableLayout.SetItemsSource(TimelineList, _viewModel.Rows);
    }
}
