using System.ComponentModel;
using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

public enum RowSaveState
{
    Idle,
    Saving,
    Saved,
    Failed,
}

// 014-admin-pagos-first-tab US4: one apartment of the redesigned "Editar pagos". Holds the editable amount and paid
// state and a visible save state ("Guardando…", "Guardado ✓", "No se guardó…") so a failed save is never silent.
// The view model drives the state; the XAML only binds to it.
public class AdminPagoEditRow : INotifyPropertyChanged
{
    private string? _amount;
    private bool _paid;
    private bool _isRegistered;
    private RowSaveState _saveState = RowSaveState.Idle;
    private string _editText;
    private bool _isEditing;

    public AdminPagoEditRow(AdminPagoRowModel row, string service, int month, int year)
    {
        Service = service;
        Month = month;
        Year = year;
        ApartmentId = row.ApartmentId;
        Number = row.ApartmentNumber;
        OwnerText = string.IsNullOrWhiteSpace(row.Owner) ? "Sin propietario" : row.Owner;
        _amount = row.Amount;
        _paid = row.Paid;
        _isRegistered = row.PaymentStatusId is not null;
        _editText = AmountInput.Display(_amount);
    }

    // 016-fix-edit-service-values: the selection this row was loaded for. Every save and retry of the row uses it, never
    // the screen's current selection, so a value can never be saved to another service or month.
    public string Service { get; }
    public int Month { get; }
    public int Year { get; }

    public long ApartmentId { get; }
    public string Number { get; }
    public string OwnerText { get; }
    public string Title => $"{Number} · {OwnerText}";

    // Digits only (see AmountInput.Parse), or null when empty.
    public string? Amount
    {
        get => _amount;
        set
        {
            if (_amount == value)
            {
                return;
            }

            _amount = value;
            Raise(nameof(Amount));
            Raise(nameof(AmountDisplay));

            // 016: while the row is being typed into, the box keeps what is typed; otherwise it follows the amount.
            if (!_isEditing)
            {
                EditText = AmountInput.Display(_amount);
            }
        }
    }

    public string AmountDisplay => AmountInput.Display(_amount);

    // 016-fix-edit-service-values: what the amount box shows, bound two-way. The page never writes the box's text from code
    // (a code write cuts a bound Entry loose from its row, which left old values on screen after a service change);
    // all changes go through this property: "$420.000" at rest, the plain digits while typing.
    public string EditText
    {
        get => _editText;
        set
        {
            if (_editText == value)
            {
                return;
            }

            _editText = value;
            Raise(nameof(EditText));
        }
    }

    public bool IsEditing => _isEditing;

    public void BeginEdit()
    {
        _isEditing = true;
        EditText = AmountInput.Raw(_amount);
        Raise(nameof(IsEditing));
    }

    // Back to the formatted amount (called when the typed text has been committed).
    public void EndEdit()
    {
        _isEditing = false;
        EditText = AmountInput.Display(_amount);
        Raise(nameof(IsEditing));
    }

    public bool Paid
    {
        get => _paid;
        set
        {
            if (_paid == value)
            {
                return;
            }

            _paid = value;
            Raise(nameof(Paid));
            Raise(nameof(StatusLabel));
            Raise(nameof(StatusKind));
        }
    }

    public string StatusLabel => _paid ? "Pagado" : "Pendiente";
    public string StatusKind => _paid ? "paid" : "pending";

    // A row without a PaymentStatus record yet (a placeholder) becomes registered on its first successful save.
    public bool IsRegistered => _isRegistered;

    public RowSaveState SaveState => _saveState;

    public bool ShowRetry => _saveState == RowSaveState.Failed;

    public string SaveMessage => _saveState switch
    {
        RowSaveState.Saving => "Guardando…",
        RowSaveState.Saved => "Guardado ✓",
        RowSaveState.Failed => "No se guardó. Revisa la conexión.",
        _ => _isRegistered ? string.Empty : "Sin registrar",
    };

    public event PropertyChangedEventHandler? PropertyChanged;

    public void MarkSaving() => SetState(RowSaveState.Saving);

    public void MarkSaved()
    {
        _isRegistered = true;
        SetState(RowSaveState.Saved);
        Raise(nameof(IsRegistered));
    }

    public void MarkFailed() => SetState(RowSaveState.Failed);

    // The "Guardado ✓" note fades after a moment (the page calls this from a timer).
    public void ClearSavedNote()
    {
        if (_saveState == RowSaveState.Saved)
        {
            SetState(RowSaveState.Idle);
        }
    }

    private void SetState(RowSaveState state)
    {
        _saveState = state;
        Raise(nameof(SaveState));
        Raise(nameof(ShowRetry));
        Raise(nameof(SaveMessage));
    }

    private void Raise(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
