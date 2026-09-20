namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// An overdue charge together with the billing period (month/year) it belongs to; the API groups
// charges by month, the "Anteriores" entry flattens several months and must still name each one.
public record CarteraPeriodCharge(CarteraChargeModel Charge, int Month, int Year);
