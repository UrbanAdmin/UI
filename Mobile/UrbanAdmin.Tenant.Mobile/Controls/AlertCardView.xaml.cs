using System.ComponentModel;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Controls;

// 017-icon-only-tab-bar: the shared alert card. All decisions (what is unread, what marking does) live in
// AlertasViewModel/AlertCardRow (Core, unit-tested); this view only shows the card, raises MarkReadRequested
// when the "Leída" swipe action is invoked, and gives a screen reader a "Marcar como leída" action.
public partial class AlertCardView : ContentView
{
    private AlertCardRow? _row;

    public AlertCardView() => InitializeComponent();

    // The page marks the alert through the view model.
    public event EventHandler<AlertCardRow>? MarkReadRequested;

    private void OnInvoked(object? sender, EventArgs e)
    {
        if (_row is { IsUnread: true } row)
        {
            MarkReadRequested?.Invoke(this, row);
        }
    }

    protected override void OnBindingContextChanged()
    {
        base.OnBindingContextChanged();

        if (_row is not null)
        {
            _row.PropertyChanged -= OnRowChanged;
        }

        _row = BindingContext as AlertCardRow;
        if (_row is not null)
        {
            _row.PropertyChanged += OnRowChanged;
        }

        UpdateAccessibility();
    }

    protected override void OnHandlerChanged()
    {
        base.OnHandlerChanged();
        UpdateAccessibility();
    }

    private void OnRowChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(AlertCardRow.IsUnread))
        {
            UpdateAccessibility();
        }
    }

    // The card is announced by its AccessibleName ("Nuevo. ..." while unread) and, while unread, offers the action
    // "Marcar como leída" (a swipe cannot be used with a screen reader). Never throws.
    private void UpdateAccessibility()
    {
        try
        {
            if (_row is null)
            {
                return;
            }

            SemanticProperties.SetDescription(this, _row.AccessibleName);
            AccessibilityAction.Apply(this, _row.IsUnread ? () => OnInvoked(this, EventArgs.Empty) : null);
        }
        catch (Exception)
        {
            // Accessibility niceties never break the card.
        }
    }
}
