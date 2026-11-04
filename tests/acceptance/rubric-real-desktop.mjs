// Historical pilot authorization cannot be reused for a new run.
// The prior runner is preserved in Git and the pre-edit source checkpoint.
throw new Error('Historical real-model pilot is disabled. A new isolated runner must verify the current model revision, price, retry policy and cumulative authorized budget before any model request.');
