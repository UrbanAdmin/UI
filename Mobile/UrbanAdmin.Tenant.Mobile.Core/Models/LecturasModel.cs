namespace UrbanAdmin.Tenant.Mobile.Core.Models;

public class LecturasBreakdownLineModel
{
    public string Label { get; set; } = string.Empty;
    public string? Value { get; set; }
}

// Mirrors GET /tenant/lecturas's response shape (contracts/tenant-lecturas-api.md).
public class LecturasModel
{
    public string State { get; set; } = "empty";
    public string? Unit { get; set; }
    public string? PreviousReading { get; set; }
    public string? CurrentReading { get; set; }
    public string? Consumption { get; set; }
    public string? Percentage { get; set; }
    public List<LecturasBreakdownLineModel>? Breakdown { get; set; }
    public string? Total { get; set; }
}

// Mirrors one entry of the existing GET /WaterBills's "periods" array - reused as-is for Agua's
// period picker (research.md: a second new endpoint here would just duplicate its own filter).
public class LecturasPeriodoModel
{
    public long Id { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool Confirmed { get; set; }
}

// Wraps GET /WaterBills's actual response shape ({ periods: [...], nextSuggestedStartDate }) -
// NextSuggestedStartDate is admin-only (null for an ApartmentOwner caller) and unused here.
public class LecturasPeriodoListModel
{
    public List<LecturasPeriodoModel> Periods { get; set; } = [];
}
