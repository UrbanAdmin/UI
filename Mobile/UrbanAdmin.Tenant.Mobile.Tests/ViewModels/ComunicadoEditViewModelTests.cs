using UrbanAdmin.Tenant.Mobile.Core.Models;
using UrbanAdmin.Tenant.Mobile.Core.ViewModels;
using UrbanAdmin.Tenant.Mobile.Tests.TestDoubles;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 013 slice C (T056, FR-012, FR-015): create, edit and delete one announcement. Client-side Spanish
// validation mirrors the server (title 1-80, message 1-1000 after trimming) with the mockup's wording.
public class ComunicadoEditViewModelTests
{
    private static async Task<(FakeAdminApiClient Api, ComunicadoEditViewModel Vm)> Build(bool signedIn = true)
    {
        var api = new FakeAdminApiClient();
        var tokens = new FakeTokenStore();
        if (signedIn)
        {
            await tokens.SaveTokenAsync("admin-jwt");
        }

        return (api, new ComunicadoEditViewModel(api, tokens, new FakeCrashDiagnosticsService()));
    }

    [Fact]
    public async Task SaveAsync_WhenCreating_SendsTheTrimmedText()
    {
        var (api, vm) = await Build();
        vm.Title = "  Mantenimiento del ascensor ";
        vm.Body = " Sábado de 8:00 a 12:00. ";

        var saved = await vm.SaveAsync();

        Assert.True(saved);
        Assert.Equal(("Mantenimiento del ascensor", "Sábado de 8:00 a 12:00."), api.LastCreatedComunicado);
        Assert.Null(api.LastUpdatedComunicado);
    }

    [Fact]
    public async Task SaveAsync_WhenEditing_UpdatesThatAnnouncement()
    {
        var (api, vm) = await Build();
        vm.ComunicadoId = 7;
        vm.Title = "Nuevo título";
        vm.Body = "Nuevo texto";

        var saved = await vm.SaveAsync();

        Assert.True(saved);
        Assert.Equal((7L, "Nuevo título", "Nuevo texto"), api.LastUpdatedComunicado);
        Assert.Null(api.LastCreatedComunicado);
    }

    [Fact]
    public async Task Load_FillsTheFormFromAnExistingAnnouncement()
    {
        var (_, vm) = await Build();

        vm.Load(new ComunicadoModel { Id = 3, Title = "Aviso", Body = "Texto" });

        Assert.Equal(3, vm.ComunicadoId);
        Assert.Equal("Aviso", vm.Title);
        Assert.Equal("Texto", vm.Body);
        Assert.True(vm.IsEditing);
    }

    [Theory]
    [InlineData("", "Mensaje", "El título es obligatorio.", null)]
    [InlineData("   ", "Mensaje", "El título es obligatorio.", null)]
    [InlineData("Título", "", null, "El mensaje es obligatorio.")]
    [InlineData("Título", "  ", null, "El mensaje es obligatorio.")]
    [InlineData("", "", "El título es obligatorio.", "El mensaje es obligatorio.")]
    public async Task SaveAsync_WithEmptyFields_ExplainsWhatToFixAndSavesNothing(string title, string body, string? titleError, string? bodyError)
    {
        var (api, vm) = await Build();
        vm.Title = title;
        vm.Body = body;

        var saved = await vm.SaveAsync();

        Assert.False(saved);
        Assert.Equal(titleError, vm.TitleError);
        Assert.Equal(bodyError, vm.BodyError);
        Assert.Null(api.LastCreatedComunicado);
    }

    [Fact]
    public async Task SaveAsync_WithTooLongText_ExplainsTheLimits_AndTheExactLimitsAreAccepted()
    {
        var (api, vm) = await Build();
        vm.Title = new string('a', 81);
        vm.Body = new string('b', 1001);

        var rejected = await vm.SaveAsync();

        Assert.False(rejected);
        Assert.Equal("El título no puede superar 80 caracteres.", vm.TitleError);
        Assert.Equal("El mensaje no puede superar 1000 caracteres.", vm.BodyError);
        Assert.Null(api.LastCreatedComunicado);

        vm.Title = new string('a', 80);
        vm.Body = new string('b', 1000);

        Assert.True(await vm.SaveAsync());
        Assert.Null(vm.TitleError);
        Assert.Null(vm.BodyError);
    }

    [Fact]
    public async Task SaveAsync_WhenTheServerRejects_ShowsItsMessage()
    {
        var (api, vm) = await Build();
        api.SaveComunicadoResult = new AdminWriteResult(false, "Escribe el título del comunicado.");
        vm.Title = "Aviso";
        vm.Body = "Texto";

        var saved = await vm.SaveAsync();

        Assert.False(saved);
        Assert.Equal("Escribe el título del comunicado.", vm.ErrorMessage);
    }

    [Fact]
    public async Task SaveAsync_WhenTheConnectionFails_ShowsASpanishMessage()
    {
        var (api, vm) = await Build();
        api.ThrowOnSaveComunicado = true;
        vm.Title = "Aviso";
        vm.Body = "Texto";

        var saved = await vm.SaveAsync();

        Assert.False(saved);
        Assert.Equal("No se pudo guardar. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
        Assert.False(vm.IsBusy);
    }

    [Fact]
    public async Task SaveAsync_ClearsEarlierMessagesOnASuccessfulSave()
    {
        var (_, vm) = await Build();
        vm.Title = "";
        vm.Body = "Texto";
        await vm.SaveAsync();
        vm.Title = "Aviso";

        var saved = await vm.SaveAsync();

        Assert.True(saved);
        Assert.Null(vm.TitleError);
        Assert.Null(vm.ErrorMessage);
    }

    [Fact]
    public async Task SaveAsync_WithoutASession_FailsWithAMessage()
    {
        var (_, vm) = await Build(signedIn: false);
        vm.Title = "Aviso";
        vm.Body = "Texto";

        Assert.False(await vm.SaveAsync());
        Assert.NotNull(vm.ErrorMessage);
    }

    [Fact]
    public async Task DeleteAsync_RemovesTheEditedAnnouncement()
    {
        var (api, vm) = await Build();
        vm.ComunicadoId = 5;

        var deleted = await vm.DeleteAsync();

        Assert.True(deleted);
        Assert.Equal(5, api.LastDeletedComunicadoId);
    }

    [Fact]
    public async Task DeleteAsync_WhenCreating_DoesNothing()
    {
        var (api, vm) = await Build();

        Assert.False(await vm.DeleteAsync());
        Assert.Null(api.LastDeletedComunicadoId);
    }

    [Fact]
    public async Task DeleteAsync_WhenTheConnectionFails_ShowsASpanishMessage()
    {
        var (api, vm) = await Build();
        api.ThrowOnDeleteComunicado = true;
        vm.ComunicadoId = 5;

        var deleted = await vm.DeleteAsync();

        Assert.False(deleted);
        Assert.Equal("No se pudo eliminar. Verifica tu conexión e intenta de nuevo.", vm.ErrorMessage);
        Assert.False(vm.IsBusy);
    }
}
