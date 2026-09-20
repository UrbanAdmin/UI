namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// The detailed admin Pagos screen's year picker: a 7-year sliding window (last year .. +5),
// mirroring Angular's payments.component.ts. Opened from a Cartera month, the requested year can
// fall outside it (overdue debt ages), so the window widens to include it
// (012-cartera-vencida-timeline US2).
public static class AdminPagosPeriodWindow
{
    public static List<int> YearsFor(int currentYear, int? requestedYear = null)
    {
        var years = Enumerable.Range(currentYear - 1, 7).ToList();
        if (requestedYear is int requested && !years.Contains(requested))
        {
            years.Add(requested);
            years.Sort();
        }

        return years;
    }

    // The Cartera "Año" selector: the same window plus every year the overdue data reaches into.
    public static List<int> YearsWithData(int currentYear, IEnumerable<int> dataYears) =>
        YearsFor(currentYear).Concat(dataYears).Distinct().Order().ToList();
}
