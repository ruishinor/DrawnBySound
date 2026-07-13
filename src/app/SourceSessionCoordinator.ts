/**
 * Serializes asynchronous source changes. A source that finishes after a newer
 * user action is stale and must be stopped instead of becoming active.
 */
export interface StoppableSource {
  stop(): void;
}

export class SourceSessionCoordinator {
  private revision = 0;

  begin(): number {
    this.revision += 1;
    return this.revision;
  }

  isCurrent(revision: number): boolean {
    return revision === this.revision;
  }

  adopt<T extends StoppableSource>(revision: number, source: T): T | null {
    if (this.isCurrent(revision)) return source;
    source.stop();
    return null;
  }
}
