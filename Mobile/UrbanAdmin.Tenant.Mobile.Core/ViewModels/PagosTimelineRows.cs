using UrbanAdmin.Tenant.Mobile.Core.Formatting;
using UrbanAdmin.Tenant.Mobile.Core.Models;

namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// One entry of the tenant Pagos timeline: pure text and a status key (paid | overdue | due-today |
// due-soon | not-due) - the page maps the key to the theme's dot/chip colors, no colors here.
public record PagoTimelineRow(
    string Utility,
    string DateLine,
    string AmountDisplay,
    bool AmountMissing,
    string StatusLabel,
    string StatusKind,
    bool Paid);

public static class PagosTimelineRows
{
    public static List<PagoTimelineRow> Build(IEnumerable<PagoModel> pagos) =>
        pagos.Select(p =>
        {
            // An older Backend does not send a status: paid stays paid, everything else is pending.
            var kind = string.IsNullOrEmpty(p.Status) ? (p.Paid ? "paid" : "not-due") : p.Status;
            return new PagoTimelineRow(
                p.Utility,
                TenantChargeFormatting.DateLine(p.Paid, p.DueDate, p.PaidAt),
                CarteraFormatting.AmountDisplay(p.AmountValue),
                p.AmountValue is null,
                TenantChargeFormatting.StatusLabel(kind),
                kind,
                p.Paid);
        }).ToList();
}
