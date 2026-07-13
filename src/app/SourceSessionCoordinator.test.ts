import { describe, expect, it, vi } from 'vitest';
import { SourceSessionCoordinator } from './SourceSessionCoordinator';

describe('SourceSessionCoordinator', () => {
  it('accepts a resource from the current source request', () => {
    const sessions = new SourceSessionCoordinator();
    const revision = sessions.begin();
    const resource = { stop: vi.fn() };

    expect(sessions.adopt(revision, resource)).toBe(resource);
    expect(resource.stop).not.toHaveBeenCalled();
  });

  it('stops a resource that resolves after a newer user action', () => {
    const sessions = new SourceSessionCoordinator();
    const staleRevision = sessions.begin();
    sessions.begin();
    const resource = { stop: vi.fn() };

    expect(sessions.adopt(staleRevision, resource)).toBeNull();
    expect(resource.stop).toHaveBeenCalledOnce();
  });

  it('invalidates every earlier request when a new source request begins', () => {
    const sessions = new SourceSessionCoordinator();
    const first = sessions.begin();
    const second = sessions.begin();
    const third = sessions.begin();

    expect(sessions.isCurrent(first)).toBe(false);
    expect(sessions.isCurrent(second)).toBe(false);
    expect(sessions.isCurrent(third)).toBe(true);
  });
});
