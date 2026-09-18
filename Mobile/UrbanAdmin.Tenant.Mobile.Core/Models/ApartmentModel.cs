namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors the Backend's ApartmentDto (specs/008-mobile-admin-views/data-model.md).
public class ApartmentModel
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public DateTime? ContractStartDate { get; set; }
    public bool HasContract { get; set; }
    public string? ContractFileName { get; set; }
    public string Status { get; set; } = string.Empty;
}
