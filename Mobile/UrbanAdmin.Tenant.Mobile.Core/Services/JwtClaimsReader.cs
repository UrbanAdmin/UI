using System.Text.Json;

namespace UrbanAdmin.Tenant.Mobile.Core.Services;

// Decodes the standard `sub` claim from a JWT's payload segment client-side - no
// Backend change needed, since the Backend's JwtTokenGenerator already puts
// user.Id there (research.md §4). Never validates the signature: this is only
// ever used to read a value out of a token the app already trusts (it was
// returned by the Backend's own login response), not to authenticate it.
public static class JwtClaimsReader
{
    public static string? GetUserId(string token)
    {
        var parts = token.Split('.');
        if (parts.Length < 2)
        {
            return null;
        }

        try
        {
            var payloadJson = Base64UrlDecode(parts[1]);
            using var document = JsonDocument.Parse(payloadJson);
            return document.RootElement.TryGetProperty("sub", out var sub) ? sub.GetString() : null;
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            return null;
        }
    }

    private static string Base64UrlDecode(string input)
    {
        var base64 = input.Replace('-', '+').Replace('_', '/');
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(base64));
    }
}
