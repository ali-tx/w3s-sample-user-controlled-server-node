"use strict";
// Copyright (c) 2024, Circle Technologies, LLC. All rights reserved.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3_1 = require("sqlite3");
const sqliteUserDAO_1 = require("../sqliteUserDAO");
const crypto_1 = require("crypto");
const sqliteDB_1 = require("../sqliteDB");
describe('Sqlite User DAO', () => {
    let client;
    let userDAO;
    beforeAll((done) => {
        client = new sqlite3_1.Database(':memory:');
        userDAO = new sqliteUserDAO_1.SqliteUserDAO(client);
        (0, sqliteDB_1.createUserTable)(client);
        done();
    });
    afterAll(() => {
        client.close();
    });
    describe('Sqlite User DAO Integration Tests', () => {
        it('Should create a new user', (done) => {
            const userId = (0, crypto_1.randomUUID)();
            const email = `${userId}@email.com`;
            const password = 'password';
            userDAO.insertUser(userId, email, password);
            userDAO.getUserByEmail(email, async (err, rows) => {
                expect(rows.length).toEqual(1);
                expect(rows[0].userId).toEqual(userId);
                expect(rows[0].email).toEqual(email);
                done();
            });
        });
        it('Should do nothing if user id already exists', (done) => {
            const userId = (0, crypto_1.randomUUID)();
            const email = `${userId}@email.com`;
            const password = 'password';
            userDAO.insertUser(userId, email, password);
            userDAO.insertUser(userId, `${(0, crypto_1.randomUUID)()}@email.com`, password);
            userDAO.getUserByEmail(email, async (err, rows) => {
                expect(rows.length).toEqual(1);
                expect(rows[0].userId).toEqual(userId);
                expect(rows[0].email).toEqual(email);
                done();
            });
        });
        it('Should do nothing if user email already exists', (done) => {
            const userId = (0, crypto_1.randomUUID)();
            const email = `${userId}@email.com`;
            const password = 'password';
            userDAO.insertUser(userId, email, password);
            userDAO.insertUser((0, crypto_1.randomUUID)(), email, password);
            userDAO.getUserByEmail(email, async (err, rows) => {
                expect(rows.length).toEqual(1);
                expect(rows[0].userId).toEqual(userId);
                expect(rows[0].email).toEqual(email);
                done();
            });
        });
    });
});
