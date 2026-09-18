namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors the extended TenantPagoDto (specs/008-mobile-admin-views/research.md §4) for the
// all-apartments admin case.
public class AdminPagoRowModel
{
    public long ApartmentId { get; set; }
    public string ApartmentNumber { get; set; } = string.Empty;
    public string? Owner { get; set; }
    public string Utility { get; set; } = string.Empty;
    public string? Amount { get; set; }
    public DateTime DueDate { get; set; }
    public bool Paid { get; set; }
}
