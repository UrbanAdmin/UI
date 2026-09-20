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

    // 013-tenant-pagos-alertas-redesign (additive on GET /tenant/pagos): the server-decided status
    // (paid | overdue | due-today | due-soon | not-due), the moment the administration marked the
    // charge paid (null for unpaid charges and for charges paid before that was recorded) and the
    // amount as a number (null when unrecorded).
    public string Status { get; set; } = string.Empty;
    public DateTime? PaidAt { get; set; }
    public decimal? AmountValue { get; set; }
}
