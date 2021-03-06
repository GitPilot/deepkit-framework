import {arrayBufferTo, base64ToArrayBuffer, nodeBufferToTypedArray} from '../index';
import {Buffer} from 'buffer';

test('base64ToArrayBuffer', () => {
    const buffer = Buffer.from('foo:bar', 'utf8');
    const base64 = arrayBufferTo(buffer, 'base64');

    {
        const ab = base64ToArrayBuffer(base64);
        expect(arrayBufferTo(ab, 'base64')).toBe(base64);
    }

    {
        const ab = nodeBufferToTypedArray(buffer, Uint8Array);
        expect(arrayBufferTo(ab, 'base64')).toBe(base64);
    }
});
