"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.post = post;
exports.get = get;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../../config"));
const BASE = config_1.default.CIRCLE_API_BASE_URL || 'https://api.circle.com';
const API_KEY = config_1.default.CIRCLE_API_KEY || '';
const client = axios_1.default.create({
    baseURL: BASE,
    headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
    }
});
async function post(path, body) {
    return client.post(path, body);
}
async function get(path, params) {
    return client.get(path, { params });
}
exports.default = { post, get };
