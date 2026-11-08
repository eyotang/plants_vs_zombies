// Limit simultaneous downloads, decodes and GPU uploads without changing errors.
export async function loadInBatches<T>(items: readonly T[], concurrency: number, load: (item: T) => Promise<void>) {
  let next = 0;let failure:{error:unknown}|undefined;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failure && next < items.length) {
      try { await load(items[next++]); }
      catch(error) { failure ??= {error}; }
    }
  }));
  // Finish active decodes/uploads before the caller can release their resources.
  if(failure)throw failure.error;
}

// All image families share this limit, even when their metadata loads overlap.
// Hand the occupied slot directly to the next waiter to preserve FIFO order.
let graphicsActive=0;
const graphicsWaiting:(()=>void)[]=[];
export async function loadGraphics<T>(work:()=>Promise<T>):Promise<T> {
  if(graphicsActive>=3)await new Promise<void>(resolve=>graphicsWaiting.push(resolve));
  else graphicsActive++;
  try{return await work();}
  finally{const next=graphicsWaiting.shift();if(next)next();else graphicsActive--;}
}
