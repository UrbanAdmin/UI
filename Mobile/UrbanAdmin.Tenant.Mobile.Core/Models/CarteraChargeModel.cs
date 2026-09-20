namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors CarteraChargeDto (specs/012-cartera-vencida-timeline/contracts/admin-cartera-api.md).
// Amount is null for a charge with no recorded/parseable amount ("sin monto", counts as 0).
public class CarteraChargeModel
{
    public long ApartmentId { get; set; }
    public string ApartmentNumber { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public string Service { get; set; } = string.Empty;
    public bool IsRent { get; set; }
    public decimal? Amount { get; set; }
    public DateTime DueDate { get; set; }
    public int DaysOverdue { get; set; }
    public bool Recorded { get; set; }

    // Only for "por vencer" charges (due today or later): days until the due date, 0 = due today.
    public int? DaysUntilDue { get; set; }
}
