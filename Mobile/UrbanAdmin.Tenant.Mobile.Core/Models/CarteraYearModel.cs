namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors CarteraYearDto. Months arrive newest first and only where overdue charges exist.
public class CarteraYearModel
{
    public int Year { get; set; }
    public decimal TotalServicios { get; set; }
    public decimal TotalArriendo { get; set; }
    public decimal Total { get; set; }
    public List<CarteraMonthModel> Months { get; set; } = [];
}
