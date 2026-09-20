using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 012-cartera-vencida-timeline (T056): the display-row logic of the Cartera timeline lives in Core
// so it is unit-tested; the page only maps these plain rows and the severity to MAUI types.
public class CarteraRowsBuilderTests
{
    private static CarteraChargeModel Charge(long apartmentId, string number, string service, decimal? amount, int days, bool isRent = false, string? owner = "Ana Pérez") =>
        new()
        {
            ApartmentId = apartmentId,
            ApartmentNumber = number,
            Owner = owner,
            Service = service,
            IsRent = isRent,
            Amount = amount,
            DaysOverdue = days,
        };

    private static CarteraApartmentModel Apartment(long id, int count, decimal total, bool canNotify = true, string? reason = null, bool notifiedToday = false, DateTime? last = null) =>
        new()
        {
            ApartmentId = id,
            ApartmentNumber = id.ToString(),
            ChargeCount = count,
            Total = total,
            CanNotify = canNotify,
            CannotNotifyReason = reason,
            NotifiedToday = notifiedToday,
            LastNotifiedAt = last,
        };

    private static Dictionary<long, CarteraApartmentModel> Lookup(params CarteraApartmentModel[] apartments) =>
        apartments.ToDictionary(a => a.ApartmentId);

    [Fact]
    public void BuildApartments_GroupsChargesByApartment_SplittingRentFromServices()
    {
        var charges = new List<CarteraChargeModel>
        {
            Charge(1, "101", "Agua", 40000m, 20),
            Charge(1, "101", "Arriendo", 900000m, 20, isRent: true),
            Charge(2, "102", "Luz", null, 5),
        };

        var rows = CarteraRowsBuilder.BuildApartments(charges, Lookup(Apartment(1, 2, 940000m), Apartment(2, 1, 0m)));

        Assert.Equal(2, rows.Count);
        Assert.Equal("101", rows[0].Number);
        Assert.Single(rows[0].Services);
        Assert.Single(rows[0].Rent);
        Assert.True(rows[0].HasRent);
        Assert.Equal("Agua", rows[0].Services[0].Service);
        Assert.Equal("$40.000", rows[0].Services[0].AmountDisplay);
        Assert.Equal("20 días", rows[0].Services[0].DaysLabel);
        Assert.False(rows[1].HasRent);
        Assert.True(rows[1].Services[0].AmountMissing);
        Assert.Equal("sin monto", rows[1].Services[0].AmountDisplay);
    }

    [Fact]
    public void BuildApartments_OwnerFallsBackWhenBlank()
    {
        var rows = CarteraRowsBuilder.BuildApartments(
            [Charge(1, "101", "Agua", 1000m, 3, owner: "  ")],
            Lookup(Apartment(1, 1, 1000m)));

        Assert.Equal("Sin propietario", rows[0].OwnerDisplay);
    }

    [Fact]
    public void BuildApartments_UnreachableApartment_ShowsReasonAndNoNotify()
    {
        var rows = CarteraRowsBuilder.BuildApartments(
            [Charge(1, "101", "Agua", 1000m, 3)],
            Lookup(Apartment(1, 1, 1000m, canNotify: false, reason: "Sin inquilino asignado")));

        Assert.False(rows[0].CanNotify);
        Assert.Equal("Sin inquilino asignado", rows[0].CaptionText);
        Assert.True(rows[0].HasCaption);
        Assert.False(rows[0].CaptionIsDone);
        Assert.Equal("No disponible", rows[0].NotifyText);
    }

    [Fact]
    public void BuildApartments_NotifiedToday_CaptionNamesTheLocalTime()
    {
        var last = new DateTime(2026, 9, 20, 15, 30, 0, DateTimeKind.Utc);
        var rows = CarteraRowsBuilder.BuildApartments(
            [Charge(1, "101", "Agua", 1000m, 3)],
            Lookup(Apartment(1, 1, 1000m, notifiedToday: true, last: last)));

        Assert.Equal($"Ya se notificó hoy · {last.ToLocalTime():HH:mm}", rows[0].CaptionText);
        Assert.True(rows[0].AlreadyNotifiedToday);
        Assert.True(rows[0].CaptionIsDone);
        Assert.Equal("Notificar", rows[0].NotifyText);
    }

    [Fact]
    public void BuildApartments_NotNotifiedYet_HasNoCaption()
    {
        var rows = CarteraRowsBuilder.BuildApartments(
            [Charge(1, "101", "Agua", 1000m, 3)],
            Lookup(Apartment(1, 1, 1000m)));

        Assert.False(rows[0].HasCaption);
        Assert.Equal(string.Empty, rows[0].CaptionText);
    }

    [Fact]
    public void BuildApartments_SummaryCoversOnlyTheMonthsCharges_NotTheApartmentsWholeBalance()
    {
        var charges = new List<CarteraChargeModel>
        {
            Charge(1, "101", "Agua", 40000m, 3),
            Charge(1, "101", "Luz", null, 3),
            Charge(2, "102", "Luz", 2000m, 3),
        };

        // The apartment roll-up says 3 conceptos / $2.111.200 overall; the month row must not use it.
        var rows = CarteraRowsBuilder.BuildApartments(charges, Lookup(Apartment(1, 3, 2111200m)));

        Assert.Equal("2 conceptos vencidos · $40.000", rows[0].Summary);
        Assert.Equal("1 concepto vencido · $2.000", rows[1].Summary);
    }

    [Theory]
    [InlineData(0, MonthSeverity.Recent)]
    [InlineData(30, MonthSeverity.Recent)]
    [InlineData(31, MonthSeverity.Aging)]
    [InlineData(60, MonthSeverity.Aging)]
    [InlineData(61, MonthSeverity.Severe)]
    public void SeverityOf_FollowsTheOldestChargeInTheMonth(int oldestDays, MonthSeverity expected)
    {
        var month = new CarteraMonthModel
        {
            Charges = [Charge(1, "101", "Agua", 1m, 2), Charge(1, "101", "Luz", 1m, oldestDays)],
        };

        Assert.Equal(expected, CarteraRowsBuilder.SeverityOf(month));
    }

    [Fact]
    public void SeverityOf_MonthWithoutCharges_IsRecent()
    {
        Assert.Equal(MonthSeverity.Recent, CarteraRowsBuilder.SeverityOf(new CarteraMonthModel()));
    }

    [Fact]
    public void MonthKey_IsStablePerYearAndMonth()
    {
        Assert.Equal("m:2026-9", CarteraRowsBuilder.MonthKey(2026, 9));
    }

    // ---- "por vencer" rows (FR-021) -------------------------------------------------------------

    private static CarteraChargeModel Ahead(long apartmentId, string service, decimal? amount, int daysLeft, bool isRent = false) =>
        new() { ApartmentId = apartmentId, ApartmentNumber = apartmentId.ToString(), Owner = "Ana", Service = service, IsRent = isRent, Amount = amount, DaysUntilDue = daysLeft };

    [Fact]
    public void BuildApartments_ListsUpcomingChargesApartFromOverdueOnes()
    {
        var rows = CarteraRowsBuilder.BuildApartments(
            [Charge(1, "1", "Agua", 40000m, 20)],
            Lookup(Apartment(1, 1, 40000m)),
            [Ahead(1, "Luz", 12000m, 8), Ahead(1, "Gas", null, 0)]);

        var row = Assert.Single(rows);
        Assert.Single(row.Services);
        Assert.Equal(["Luz", "Gas"], row.Upcoming.Select(r => r.Service));
        Assert.Equal(["Vence en 8 días", "Vence hoy"], row.Upcoming.Select(r => r.DaysLabel));
        Assert.Equal("$12.000", row.Upcoming[0].AmountDisplay);
        Assert.True(row.Upcoming[1].AmountMissing);
        Assert.True(row.HasUpcoming);
        Assert.Equal("1 concepto vencido · $40.000 · 2 por vencer", row.Summary);
    }

    [Fact]
    public void BuildApartments_AnApartmentWithOnlyUpcomingCharges_HasNothingOverdueAndNoNotify()
    {
        var rows = CarteraRowsBuilder.BuildApartments(
            [],
            Lookup(Apartment(1, 0, 0m)),
            [Ahead(1, "Agua", 96000m, 10)]);

        var row = Assert.Single(rows);
        Assert.False(row.HasOverdue);
        Assert.False(row.CanNotify);
        Assert.Equal("Nada vencido", row.NotifyText);
        Assert.Equal("Nada vencido · 1 por vencer", row.Summary);
        Assert.False(row.HasCaption);
        Assert.Empty(row.Services);
    }

    [Fact]
    public void BuildApartments_MergesApartmentsFromBothListsInApartmentOrder()
    {
        var rows = CarteraRowsBuilder.BuildApartments(
            [Charge(2, "202", "Agua", 1000m, 5)],
            Lookup(Apartment(2, 1, 1000m)),
            [Ahead(1, "Luz", 500m, 3), Ahead(2, "Gas", 500m, 3)]);

        Assert.Equal(["1", "202"], rows.Select(r => r.Number));
        Assert.Single(rows[1].Services);
        Assert.Single(rows[1].Upcoming);
    }

    [Fact]
    public void BuildApartments_WithoutUpcoming_KeepsTheOverdueOnlySummary()
    {
        var rows = CarteraRowsBuilder.BuildApartments([Charge(1, "101", "Agua", 40000m, 3)], Lookup(Apartment(1, 1, 40000m)));

        Assert.False(rows[0].HasUpcoming);
        Assert.Equal("1 concepto vencido · $40.000", rows[0].Summary);
    }
}
