import { post } from './circleApiService';

export async function deployToCircle(bytecode: string, name: string) {
  // Placeholder - adjust endpoint and payload per Circle API
  const resp = await post('/v1/contracts', { name, bytecode });
  return resp.data;
}

export default { deployToCircle };
