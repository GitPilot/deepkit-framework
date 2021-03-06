import 'reflect-metadata';
import {Entity, t} from '@deepkit/type';
import {BenchSuite} from '@deepkit/core';
import {Database} from '@deepkit/orm';
import {MongoDatabaseAdapter} from '@deepkit/mongo';

@Entity('deepkit')
export class DeepkitModel {
    @t.mongoId.primary public _id?: string;
    @t ready?: boolean;

    @t.array(t.string) tags: string[] = [];

    @t priority: number = 0;

    constructor(
        @t public id: number,
        @t public name: string
    ) {
    }
}

export async function main() {
    const count = 10_000;
    const database = new Database(new MongoDatabaseAdapter('mongodb://localhost/bench-small-deepkit'));

    for (let i = 0; i < 5; i++) {
        console.log('round', i);
        const session = database.createSession();
        await session.query(DeepkitModel).deleteMany();
        const bench = new BenchSuite('deepkit');

        await bench.runAsyncFix(1, 'insert', async () => {
            for (let i = 1; i <= count; i++) {
                const user = new DeepkitModel(i, 'Peter ' + i);
                user.ready = true;
                user.priority = 5;
                user.tags = ['a', 'b', 'c'];
                session.add(user);
            }

            await session.commit();
        });

        await bench.runAsyncFix(10, 'fetch', async () => {
            await session.query(DeepkitModel).disableIdentityMap().find();
        });

        const dbItems = await session.query(DeepkitModel).find();
        for (const item of dbItems) {
            item.priority++;
        }

        await bench.runAsyncFix(1, 'update', async () => {
            await session.commit();
        });

        await bench.runAsyncFix(1, 'remove', async () => {
            for (const item of dbItems) {
                session.remove(item);
            }

            await session.commit();
        });
    }

    database.disconnect();
}
