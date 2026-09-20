namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors one item of GET /tenant/alertas (specs/013-tenant-pagos-alertas-redesign/contracts).
// Kind is "payment" (a charge due within 2 days, due today or overdue), "confirmation" (a charge the
// administration marked paid) or "announcement" (a building-wide comunicado). The Backend sends facts;
// the Spanish text is built in Core by TenantChargeFormatting.
public class AlertaModel
{
    public string Kind { get; set; } = string.Empty;
    public long? Id { get; set; }
    public string? Utility { get; set; }
    public int? Month { get; set; }
    public int? Year { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal? AmountValue { get; set; }
    public string? Status { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? Title { get; set; }
    public string? Body { get; set; }

    // The instant the alert is dated by (latest reminder, paid date or announcement date), UTC.
    public DateTime At { get; set; }
}
