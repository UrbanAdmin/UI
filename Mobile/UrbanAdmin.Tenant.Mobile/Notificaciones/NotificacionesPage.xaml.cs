using System.Collections.Specialized;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Notificaciones;

// 013-tenant-pagos-alertas-redesign / 017-icon-only-tab-bar: the tenant Alertas screen. Every word, date and status
// comes from AlertasViewModel / Core (unit-tested); this page maps the unread cards onto the approved layout, reacts
// to the swipe ("Leída"), the header action "Marcar todas" and the link to the full list. Opening the screen never
// marks anything read. AlertasViewModel also keeps the Alertas tab badge (the unread count) in sync.
public partial class NotificacionesPage : ContentPage
{
    private readonly AlertasViewModel _viewModel;

    public NotificacionesPage(AlertasViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;

        // The unread list changes in place when a card is marked read; the page keeps its states in step.
        BindableLayout.SetItemsSource(CardsList, _viewModel.Cards);
        _viewModel.Cards.CollectionChanged += OnCardsChanged;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ReloadAsync();
    }

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    private async void OnMarkReadRequested(object? sender, AlertCardRow card) => await _viewModel.MarkReadAsync(card);

    private async void OnMarkAllClicked(object? sender, EventArgs e) => await _viewModel.MarkAllReadAsync();

    private async void OnSeeAllClicked(object? sender, EventArgs e) => await Shell.Current.GoToAsync("TodasAlertas");

    private void OnCardsChanged(object? sender, NotifyCollectionChangedEventArgs e) =>
        MainThread.BeginInvokeOnMainThread(ShowLoadedState);

    private async Task ReloadAsync()
    {
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ErrorPanel.IsVisible = false;
        EmptyPanel.IsVisible = false;
        CardsList.IsVisible = false;
        SwipeHint.IsVisible = false;
        SeeAllButton.IsVisible = false;
        Header.ActionText = string.Empty;

        await _viewModel.LoadAsync();

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (_viewModel.HasError)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorPanel.IsVisible = true;
            return;
        }

        ShowLoadedState();
    }

    // Unread cards (or the friendly empty state), the header action while something is unread, and the link to the
    // full list, which is always there once the alerts have loaded.
    private void ShowLoadedState()
    {
        if (_viewModel.HasError || _viewModel.IsBusy)
        {
            return;
        }

        CardsList.IsVisible = _viewModel.HasUnread;
        SwipeHint.IsVisible = _viewModel.HasUnread;
        EmptyPanel.IsVisible = !_viewModel.HasUnread;
        SeeAllButton.IsVisible = true;
        Header.ActionText = _viewModel.HasUnread ? "Marcar todas" : string.Empty;
    }
}
