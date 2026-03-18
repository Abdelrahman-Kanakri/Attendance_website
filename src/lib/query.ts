export async function withTimeout<T = any>(
  promise: PromiseLike<T>,
  ms = 10000,
  label = 'Request',
): Promise<T> {
  return await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    }),
  ]);
}
