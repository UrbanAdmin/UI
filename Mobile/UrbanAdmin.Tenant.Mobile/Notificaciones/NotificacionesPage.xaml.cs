using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Notificaciones;

// Display-only row translating NotificacionModel.Status's raw key ("due-soon", etc.) into the
// canonical Spanish label + chip color, matching Angular's status-chip.component.ts exactly -
// that component is this app's single source of truth for status labels/colors.
public record NotificacionDisplayRow(string Utility, string AmountDisplay, string DueDateDisplay, string StatusLabel, string StatusKind)
{
    public static NotificacionDisplayRow From(NotificacionModel model)
    {
        var (label, kind) = model.Status switch
        {
            "paid" => ("Pagado", "paid"),
            "due-soon" => ("Vence en 2 días", "due-soon"),
            "due-today" => ("Vence hoy", "due-today"),
            "overdue" => ("Vencido", "overdue"),
            _ => ("No vence aún", "not-due"),
        };

        var amount = model.Amount is null ? "—" : $"Monto: {CopCurrencyFormatter.Format(model.Amount)}";
        return new NotificacionDisplayRow(model.Utility, amount, $"Vence: {model.DueDate:dd/MM/yyyy}", label, kind);
    }
}

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
            ErrorLabel.Text = _viewModel.ErrorMessage;
            ErrorLabel.IsVisible = true;
        }
        else if (_viewModel.IsEmpty)
        {
            EmptyLabel.IsVisible = true;
        }
        else
        {
            ItemsList.ItemsSource = _viewModel.Items.Select(NotificacionDisplayRow.From).ToList();
            ItemsList.IsVisible = true;
        }
    }
}
