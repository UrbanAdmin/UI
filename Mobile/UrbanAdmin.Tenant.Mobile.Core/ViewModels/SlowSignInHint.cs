namespace UrbanAdmin.Tenant.Mobile.Core.ViewModels;

// 015-fix-fingerprint-reopen FR-008: after 5 seconds of waiting for the server the sign-in screen gains a reassuring line, so
// a slow (sleeping) server never looks like a frozen app. Start it when a sign-in begins and Stop it when it ends; Changed
// is raised (possibly from a background thread) whenever IsVisible flips. The delay is injectable for tests.
public class SlowSignInHint(TimeSpan? threshold = null, Func<TimeSpan, CancellationToken, Task>? delay = null)
{
    public const string Message = "El servidor está despertando, esto puede tardar hasta un minuto.";

    private readonly TimeSpan _threshold = threshold ?? TimeSpan.FromSeconds(5);
    private readonly Func<TimeSpan, CancellationToken, Task> _delay = delay ?? Task.Delay;
    private CancellationTokenSource? _cts;

    public bool IsVisible { get; private set; }

    public event Action? Changed;

    public void Start()
    {
        Stop();
        var cts = new CancellationTokenSource();
        _cts = cts;
        _ = ShowAfterDelayAsync(cts);
    }

    public void Stop()
    {
        var cts = Interlocked.Exchange(ref _cts, null);
        cts?.Cancel();
        cts?.Dispose();
        if (IsVisible)
        {
            IsVisible = false;
            Changed?.Invoke();
        }
    }

    private async Task ShowAfterDelayAsync(CancellationTokenSource cts)
    {
        try
        {
            await _delay(_threshold, cts.Token);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        if (ReferenceEquals(_cts, cts))
        {
            IsVisible = true;
            Changed?.Invoke();
        }
    }
}
