//MongoDB in-memory server test
//Modified from https://github.com/nodkz/mongodb-memory-server/blob/master/packages/mongodb-memory-server-core/src/__tests__/replset-multi.test.ts

/*
License from mongodb-memory-server repo:
The MIT License (MIT)

Copyright (c) 2017-present Pavel Chertorogov

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');

jest.setTimeout(100000); // 10s

describe('multi-member replica set', () => {
  it('should enter running state', async () => {
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 3 } });
    expect(replSet.servers.length).toEqual(3);
    expect(replSet.getUri().split(',').length).toEqual(3);

    await replSet.stop();
  }, 40000);

  it('should be possible to connect replicaset after waitUntilRunning resolveds', async () => {
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 3 } });

    const con = await MongoClient.connect(replSet.getUri(), {});

    // await while all SECONDARIES will be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const db = await con.db('admin');
    const admin = db.admin();
    const status = await admin.replSetGetStatus();
    expect(status.members.filter((m) => m.stateStr === 'PRIMARY')).toHaveLength(1);
    expect(status.members.filter((m) => m.stateStr === 'SECONDARY')).toHaveLength(2);

    await con.close();
    await replSet.stop();
  });
});