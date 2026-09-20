namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors CarteraDto (GET /admin/cartera). An empty balance is Total == 0 with empty lists.
public class CarteraModel
{
    public decimal TotalServicios { get; set; }
    public decimal TotalArriendo { get; set; }
    public decimal Total { get; set; }
    public int ChargeCount { get; set; }
    public int ApartmentCount { get; set; }
    public List<CarteraYearModel> Years { get; set; } = [];
    public List<CarteraApartmentModel> Apartments { get; set; } = [];
}
