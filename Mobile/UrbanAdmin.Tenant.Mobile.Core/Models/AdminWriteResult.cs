namespace UrbanAdmin.Tenant.Mobile.Core.Models;

// Mirrors the Backend's CreateApartmentResult/UpdateApartmentResult/CreateUserResult/
// UpdateUserResult shape (Success + Error) - every admin create/edit call surfaces the
// Backend's own validation error message rather than trusting client-side checks alone
// (specs/008-mobile-admin-views/research.md §9).
public record AdminWriteResult(bool Success, string? Error);
