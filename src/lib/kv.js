export const kvGet = (env, key) => env.KV.get(key, { type: 'json' });
export const kvSet = (env, key, val) => env.KV.put(key, JSON.stringify(val));
export const kvDel = (env, key) => env.KV.delete(key);
