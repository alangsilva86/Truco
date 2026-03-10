export class CommandQueue {
  private readonly queue: Array<() => Promise<void> | void> = [];
  private isProcessing = false;

  enqueue(job: () => Promise<void> | void): void {
    this.queue.push(job);
    void this.process();
  }

  private async process(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        continue;
      }

      await job();
    }

    this.isProcessing = false;
  }
}
