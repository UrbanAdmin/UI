namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors GET /tenant/pagos's response shape (contracts/tenant-api.md).
// Deliberately has no write-back method anywhere in this model or the
// services that produce it - Pagos is strictly read-only for tenants
// (FR-008); the only place an amount/paid status can change is the existing
// admin web app.
public class PagoModel
{
    public string Utility { get; set; } = string.Empty;
    public string? Amount { get; set; }
    public DateTime DueDate { get; set; }
    public bool Paid { get; set; }
}
