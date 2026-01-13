import axios from 'axios';
import config from '../../config';

const BASE = config.CIRCLE_API_BASE_URL || 'https://api.circle.com';
const API_KEY = config.CIRCLE_API_KEY || '';

const client = axios.create({
  baseURL: BASE,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

export async function post(path: string, body: unknown) {
  return client.post(path, body);
}

export async function get(path: string, params?: Record<string, unknown>) {
  return client.get(path, { params });
}

export default { post, get };
