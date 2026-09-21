using System.ComponentModel;
using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Admin;

// One service button of the edit screen; the selected one is filled.
public class ServiceChipItem(string name, bool isSelected)
{
    public string Name { get; } = name;
    public bool IsSelected { get; } = isSelected;
}

// 014-admin-pagos-first-tab US4 (built to Mockups/admin-pagos-edit): pick a service and a month, set the service's deadline,
// and edit each apartment's amount and paid state. Every change still saves immediately (008-mobile-admin-views
// Phase 6b), but each row now shows the outcome. State and wording live in AdminPagosEditViewModel / AdminPagoEditRow
// (Core, unit-tested); this page only maps them onto the layout. It opens on the month the administrator was viewing on
// Pagos ("AdminPagosEdit?month=&year=").
public partial class AdminPagosEditPage : ContentPage, IQueryAttributable
{
    private readonly AdminPagosEditViewModel _viewModel;
    private readonly PagosMonthNavigator _navigator = new();
    private bool _isFirstAppearance = true;
    private bool _settingDate;

    // 016-fix-edit-service-values: the amount field that has focus, so it can be saved for the place it was typed in BEFORE a
    // service or month change (the tap changes the selection first and the field only loses focus afterwards).
    private Entry? _focusedEntry;

    public AdminPagosEditPage(AdminPagosEditViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _navigator.Set(_viewModel.Month, _viewModel.Year);
    }

    public void ApplyQueryAttributes(IDictionary<string, object> query)
    {
        if (query.TryGetValue("month", out var rawMonth) && query.TryGetValue("year", out var rawYear)
            && int.TryParse(rawMonth?.ToString(), out var month) && int.TryParse(rawYear?.ToString(), out var year)
            && month is >= 1 and <= 12)
        {
            _navigator.Set(month, year);
            _viewModel.Month = _navigator.Month;
            _viewModel.Year = _navigator.Year;
        }
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        if (!_isFirstAppearance)
        {
            return;
        }

        _isFirstAppearance = false;
        await _viewModel.LoadUtilitiesAsync();
        var names = _viewModel.ServiceNames;
        if (names.Count > 0)
        {
            _viewModel.Service = names[0];
        }

        RenderServices();
        await ReloadAsync();
    }

    private void RenderServices() =>
        BindableLayout.SetItemsSource(
            ServiceList,
            _viewModel.ServiceNames.Select(n => new ServiceChipItem(n, n == _viewModel.Service)).ToList());

    private async void OnServiceTapped(object? sender, TappedEventArgs e)
    {
        if ((sender as BindableObject)?.BindingContext is ServiceChipItem chip && chip.Name != _viewModel.Service)
        {
            await FlushPendingAmountAsync();
            _viewModel.Service = chip.Name;
            RenderServices();
            await ReloadAsync();
        }
    }

    private async void OnPreviousTapped(object? sender, TappedEventArgs e)
    {
        if (_navigator.Previous())
        {
            await MoveToNavigatorMonthAsync();
        }
    }

    private async void OnNextTapped(object? sender, TappedEventArgs e)
    {
        if (_navigator.Next())
        {
            await MoveToNavigatorMonthAsync();
        }
    }

    private async Task MoveToNavigatorMonthAsync()
    {
        await FlushPendingAmountAsync();
        _viewModel.Month = _navigator.Month;
        _viewModel.Year = _navigator.Year;
        await ReloadAsync();
    }

    private async void OnRetryClicked(object? sender, EventArgs e) => await ReloadAsync();

    // ---- deadline -------------------------------------------------------------------------

    private void OnDeadlineDateSelected(object? sender, DateChangedEventArgs e)
    {
        if (_settingDate || e.NewDate is not DateTime date)
        {
            return;
        }

        _viewModel.SetPendingDeadline(date);
        RenderDeadline();
    }

    private async void OnSaveDeadlineClicked(object? sender, EventArgs e)
    {
        ErrorLabel.IsVisible = false;
        var success = await _viewModel.SaveDeadlineAsync();
        if (!success && _viewModel.ErrorMessage is not null)
        {
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
        }

        RenderDeadline();
    }

    private void RenderDeadline()
    {
        var showCard = _viewModel.ShowDeadlineCard;
        DeadlineCard.IsVisible = showCard;
        ArriendoCard.IsVisible = !showCard;
        ArriendoHintLabel.Text = _viewModel.ArriendoHint;
        if (!showCard)
        {
            return;
        }

        DeadlineTitleLabel.Text = _viewModel.DeadlineTitle;
        DeadlineValueLabel.Text = _viewModel.DeadlineDisplay;
        SaveDeadlineButton.IsEnabled = _viewModel.DeadlineDirty;
        DeadlineNoteLabel.Text = _viewModel.DeadlineNote;
        DeadlineNoteLabel.IsVisible = _viewModel.DeadlineNote.Length > 0 && !_viewModel.DeadlineDirty;
    }

    // ---- rows -----------------------------------------------------------------------------

    // The field shows the plain digits while it is being edited and "$420.000" at rest.
    private void OnAmountFocused(object? sender, FocusEventArgs e)
    {
        if (sender is Entry { BindingContext: AdminPagoEditRow row } entry)
        {
            _focusedEntry = entry;
            row.BeginEdit();
            entry.CursorPosition = 0;
            entry.SelectionLength = row.EditText.Length;
        }
    }

    private async void OnAmountUnfocused(object? sender, FocusEventArgs e)
    {
        if (ReferenceEquals(_focusedEntry, sender))
        {
            _focusedEntry = null;
        }

        if (sender is Entry { BindingContext: AdminPagoEditRow row })
        {
            // The box is bound two-way to row.EditText, which is what was typed; the commit returns it to "$420.000".
            await _viewModel.CommitAmountAsync(row, row.EditText);
            AfterSave(row);
        }
    }

    // Saves the amount being typed (if any) for the service and month of its own row, now. Called before the selection
    // changes and when the screen is left, so a typed value is never dropped and never lands on another service or month.
    // Afterwards the field's own Unfocused finds nothing changed and does nothing.
    private async Task FlushPendingAmountAsync()
    {
        if (_focusedEntry is not { BindingContext: AdminPagoEditRow row } entry)
        {
            return;
        }

        _focusedEntry = null;
        await _viewModel.CommitAmountAsync(row, row.EditText);
        AfterSave(row);
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        await FlushPendingAmountAsync();
    }

    private void OnAmountCompleted(object? sender, EventArgs e) => (sender as Entry)?.Unfocus();

    private async void OnStatusTapped(object? sender, TappedEventArgs e)
    {
        if ((sender as BindableObject)?.BindingContext is AdminPagoEditRow row)
        {
            await _viewModel.TogglePaidAsync(row);
            AfterSave(row);
        }
    }

    private async void OnRetryRowTapped(object? sender, TappedEventArgs e)
    {
        if ((sender as BindableObject)?.BindingContext is AdminPagoEditRow row)
        {
            await _viewModel.SaveRowAsync(row);
            AfterSave(row);
        }
    }

    // Refreshes the counter and lets "Guardado ✓" fade after a moment.
    private void AfterSave(AdminPagoEditRow row)
    {
        PaidSummaryLabel.Text = _viewModel.PaidSummary;
        if (row.SaveState == RowSaveState.Saved)
        {
            Dispatcher.DispatchDelayed(TimeSpan.FromSeconds(2.5), row.ClearSavedNote);
        }
    }

    private async Task ReloadAsync()
    {
        RenderNavigator();
        BusyIndicator.IsVisible = true;
        BusyIndicator.IsRunning = true;
        ContentPanel.IsVisible = false;
        ErrorPanel.IsVisible = false;
        ErrorLabel.IsVisible = false;

        // 016: a load that a newer selection superseded is ignored; the newer one is updating the screen.
        if (!await _viewModel.LoadAsync())
        {
            return;
        }

        BusyIndicator.IsVisible = false;
        BusyIndicator.IsRunning = false;

        if (_viewModel.HasError)
        {
            ErrorPanel.IsVisible = true;
            return;
        }

        _settingDate = true;
        DeadlineDatePicker.Date = _viewModel.SavedDeadline ?? DateTime.Today;
        _settingDate = false;
        RenderDeadline();

        PaidSummaryLabel.Text = _viewModel.PaidSummary;
        EmptyPanel.IsVisible = _viewModel.IsEmpty;

        // Clear first so every row's views are rebuilt from scratch for the new service and month.
        BindableLayout.SetItemsSource(RowList, null);
        BindableLayout.SetItemsSource(RowList, _viewModel.Rows);
        ContentPanel.IsVisible = true;
    }

    private void RenderNavigator()
    {
        MonthLabel.Text = _navigator.Label;
        PreviousButton.Opacity = _navigator.CanGoPrevious ? 1 : 0.35;
        NextButton.Opacity = _navigator.CanGoNext ? 1 : 0.35;
    }
}
