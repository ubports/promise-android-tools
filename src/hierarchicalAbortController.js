// @ts-check

export class HierarchicalAbortController extends AbortController {
  /** @param {...AbortSignal} signals */
  constructor(...signals) {
    super();
    this.listen(...signals);
  }

  /** @param {...AbortSignal} signals */
  listen(...signals) {
    for (const signal of signals) {
      if (signal.aborted) return this.abort();
      // @ts-ignore
      signal.addEventListener("abort", this.abort.bind(this));
    }
  }
}
