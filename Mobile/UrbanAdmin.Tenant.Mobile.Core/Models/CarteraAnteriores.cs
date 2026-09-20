namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// The closing "Anteriores" entry of the Cartera timeline (FR-020): the OVERDUE debt of every month
// before January of last year, summarized in one place. FromYear is that January's year. Built by
// CarteraViewModel from the loaded data; never sent to a notice.
public class CarteraAnteriores
{
    public int FromYear { get; init; }
    public decimal TotalServicios { get; init; }
    public decimal TotalArriendo { get; init; }
    public decimal Total => TotalServicios + TotalArriendo;
    public int ChargeCount { get; init; }
    public int ApartmentCount { get; init; }
    public List<CarteraPeriodCharge> Charges { get; init; } = [];
}
