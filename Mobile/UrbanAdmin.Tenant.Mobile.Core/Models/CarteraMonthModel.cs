namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors CarteraMonthDto. Total == TotalServicios + TotalArriendo; charges arrive ordered by
// apartment then service with rent last.
public class CarteraMonthModel
{
    public int Month { get; set; }
    public int Year { get; set; }
    public decimal TotalServicios { get; set; }
    public decimal TotalArriendo { get; set; }
    public decimal Total { get; set; }
    public int ChargeCount { get; set; }
    public int ApartmentCount { get; set; }
    public List<CarteraChargeModel> Charges { get; set; } = [];

    // "Por vencer" (FR-021): unpaid charges not yet due, kept apart from the overdue figures above
    // and never summed into them.
    public List<CarteraChargeModel> UpcomingCharges { get; set; } = [];
    public decimal UpcomingServicios { get; set; }
    public decimal UpcomingArriendo { get; set; }
    public decimal UpcomingTotal { get; set; }
    public int UpcomingChargeCount { get; set; }
}
