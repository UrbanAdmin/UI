using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 014-admin-pagos-first-tab: the display rules of the approved Pagos month card (month, then apartment
// with its arrendatario, then every service).
public class AdminPagosMonthCardTests
{
    private static AdminPagoRowModel Row(long apt, string number, string? owner, string utility, string? amount, bool paid,
        DateTime? due = null, long? id = 1) =>
        new()
        {
            ApartmentId = apt,
            ApartmentNumber = number,
            Owner = owner,
            Utility = utility,
            Amount = amount,
            Paid = paid,
            DueDate = due ?? new DateTime(2026, 9, 15),
            PaymentStatusId = id,
        };

    [Fact]
    public void Build_TitlesTheCardWithTheMonthAndSummarisesApartments()
    {
        var rows = new List<AdminPagoRowModel>
        {
            Row(1, "101", "María Restrepo", "Agua", "86400", paid: true),
            Row(2, "202", "Camilo Ochoa", "Agua", "79800", paid: false),
        };

        var card = AdminPagosMonthCard.Build(rows, 9, 2026);

        Assert.Equal("Septiembre 2026", card.Title);
        Assert.Equal("2 apartamentos · 1 al día", card.Summary);
        Assert.Equal(79800m, card.TotalOwed);
        Assert.Equal("$79.800", card.TotalDisplay);
        Assert.False(card.AllUpToDate);
    }

    [Fact]
    public void Build_OrdersApartmentsByNumber_AndTitlesEachWithTheOwner()
    {
        var rows = new List<AdminPagoRowModel>
        {
            Row(3, "301", "Diana Ruiz", "Agua", "1000", paid: true),
            Row(1, "101", "María Restrepo", "Agua", "1000", paid: true),
            Row(2, "402", "", "Agua", "0", paid: false),
        };

        var card = AdminPagosMonthCard.Build(rows, 9, 2026);

        Assert.Equal(["101 · María Restrepo", "301 · Diana Ruiz", "402 · Sin propietario"],
            card.Apartments.Select(a => a.Title));
    }

    [Fact]
    public void Build_AmountOwedSumsOnlyUnpaidRegisteredCharges()
    {
        var rows = new List<AdminPagoRowModel>
        {
            Row(2, "202", "Camilo Ochoa", "Administración", "420000", paid: true),
            Row(2, "202", "Camilo Ochoa", "Agua", "79800", paid: false),
            Row(2, "202", "Camilo Ochoa", "Energía", "120400", paid: false),
            Row(2, "202", "Camilo Ochoa", "Gas", null, paid: false),
            Row(2, "202", "Camilo Ochoa", "Arriendo", "not-a-number", paid: false),
            Row(2, "202", "Camilo Ochoa", "Internet", "50000", paid: false, id: null),
        };

        var apartment = Assert.Single(AdminPagosMonthCard.Build(rows, 9, 2026).Apartments);

        Assert.Equal(200200m, apartment.AmountOwed);
        Assert.Equal("$200.200", apartment.OwedDisplay);
        Assert.False(apartment.IsUpToDate);
    }

    [Fact]
    public void Build_ApartmentWithNothingOwedReadsAlDia()
    {
        var rows = new List<AdminPagoRowModel>
        {
            Row(1, "101", "María Restrepo", "Agua", "86400", paid: true),
            Row(1, "101", "María Restrepo", "Gas", null, paid: false, id: null),
        };

        var apartment = Assert.Single(AdminPagosMonthCard.Build(rows, 9, 2026).Apartments);

        Assert.Equal(0m, apartment.AmountOwed);
        Assert.Equal("Al día", apartment.OwedDisplay);
        Assert.True(apartment.IsUpToDate);
    }

    [Fact]
    public void Build_ListsEveryServiceAndFlagsThePendingOnes()
    {
        var rows = new List<AdminPagoRowModel>
        {
            Row(2, "202", "Camilo Ochoa", "Agua", "79800", paid: false),
            Row(2, "202", "Camilo Ochoa", "Energía", "120400", paid: true),
            Row(2, "202", "Camilo Ochoa", "Gas", null, paid: false, id: null),
        };

        var apartment = Assert.Single(AdminPagosMonthCard.Build(rows, 9, 2026).Apartments);

        Assert.Equal(["Agua", "Energía", "Gas"], apartment.Services.Select(s => s.Name));
        Assert.Equal([true, false, false], apartment.Services.Select(s => s.IsPending));
    }

    [Fact]
    public void Build_ServiceLinesCarryDeadlineAmountAndStatus()
    {
        var rows = new List<AdminPagoRowModel>
        {
            Row(2, "202", "Camilo Ochoa", "Agua", "79800", paid: false, due: new DateTime(2026, 9, 15)),
            Row(2, "202", "Camilo Ochoa", "Energía", "120400", paid: true, due: DateTime.MinValue),
            Row(2, "202", "Camilo Ochoa", "Gas", null, paid: false),
            Row(2, "202", "Camilo Ochoa", "Internet", null, paid: false, id: null),
        };

        var lines = Assert.Single(AdminPagosMonthCard.Build(rows, 9, 2026).Apartments).Lines;

        Assert.Equal(("Agua", "Vence el 15 sep", "$79.800", "Pendiente", "pending"),
            (lines[0].Utility, lines[0].DeadlineText, lines[0].AmountDisplay, lines[0].StatusLabel, lines[0].StatusKind));
        Assert.Equal(("Sin fecha", "$120.400", "Pagado", "paid"),
            (lines[1].DeadlineText, lines[1].AmountDisplay, lines[1].StatusLabel, lines[1].StatusKind));
        Assert.Equal("sin monto", lines[2].AmountDisplay);
        Assert.Equal(("Sin registrar", "Nada aún", "placeholder"),
            (lines[3].AmountDisplay, lines[3].StatusLabel, lines[3].StatusKind));
    }

    [Fact]
    public void Build_WhenEveryoneIsUpToDate_FlagsTheCard()
    {
        var rows = new List<AdminPagoRowModel>
        {
            Row(1, "101", "María Restrepo", "Agua", "86400", paid: true),
            Row(2, "202", "Camilo Ochoa", "Agua", "79800", paid: true),
        };

        var card = AdminPagosMonthCard.Build(rows, 9, 2026);

        Assert.True(card.AllUpToDate);
        Assert.Equal("Al día", card.TotalDisplay);
        Assert.Equal("2 apartamentos · 2 al día", card.Summary);
    }

    [Fact]
    public void Build_WithNoRows_IsAnEmptyCard()
    {
        var card = AdminPagosMonthCard.Build([], 9, 2026);

        Assert.Empty(card.Apartments);
        Assert.Equal("Septiembre 2026", card.Title);
    }
}
