using UrbanAdmin.Tenant.Mobile.Core.ViewModels;

namespace UrbanAdmin.Tenant.Mobile.Tests.ViewModels;

// 015-fix-fingerprint-reopen FR-008: after 5 seconds of waiting the sign-in gains a reassuring line, so a slow server
// never looks like a frozen screen. The delay is injected so the timing is testable.
public class SlowSignInHintTests
{
    private sealed class ManualDelay
    {
        private readonly TaskCompletionSource _elapsed = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TimeSpan? Requested { get; private set; }

        public Task Wait(TimeSpan span, CancellationToken token)
        {
            Requested = span;
            token.Register(() => _elapsed.TrySetCanceled(token));
            return _elapsed.Task;
        }

        public void Elapse() => _elapsed.TrySetResult();
    }

    [Fact]
    public void Message_IsTheReassuringLine() =>
        Assert.Equal("El servidor está despertando, esto puede tardar hasta un minuto.", SlowSignInHint.Message);

    [Fact]
    public void ItStartsHiddenAndWaitsFiveSeconds()
    {
        var delay = new ManualDelay();
        var hint = new SlowSignInHint(delay: delay.Wait);

        hint.Start();

        Assert.False(hint.IsVisible);
        Assert.Equal(TimeSpan.FromSeconds(5), delay.Requested);
    }

    [Fact]
    public async Task ItBecomesVisibleOnceTheThresholdPasses_AndReportsTheChange()
    {
        var delay = new ManualDelay();
        var hint = new SlowSignInHint(delay: delay.Wait);
        var changed = new TaskCompletionSource();
        hint.Changed += () => changed.TrySetResult();
        hint.Start();

        delay.Elapse();
        await changed.Task.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.True(hint.IsVisible);
    }

    [Fact]
    public async Task StoppingBeforeTheThresholdNeverShowsIt()
    {
        var delay = new ManualDelay();
        var hint = new SlowSignInHint(delay: delay.Wait);
        var raised = false;
        hint.Changed += () => raised = true;
        hint.Start();

        hint.Stop();
        delay.Elapse();
        await Task.Delay(50);

        Assert.False(hint.IsVisible);
        Assert.False(raised);
    }

    [Fact]
    public async Task StoppingHidesItAgainAndReportsTheChange()
    {
        var delay = new ManualDelay();
        var hint = new SlowSignInHint(delay: delay.Wait);
        var shown = new TaskCompletionSource();
        hint.Changed += () => shown.TrySetResult();
        hint.Start();
        delay.Elapse();
        await shown.Task.WaitAsync(TimeSpan.FromSeconds(2));
        var changes = 0;
        hint.Changed += () => changes++;

        hint.Stop();

        Assert.False(hint.IsVisible);
        Assert.Equal(1, changes);
    }

    [Fact]
    public void AStoppedHintCanStartAgainForTheNextSignIn()
    {
        var first = new ManualDelay();
        var hint = new SlowSignInHint(delay: first.Wait);
        hint.Start();
        hint.Stop();

        hint.Start();

        Assert.False(hint.IsVisible);
    }
}
