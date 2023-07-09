import { test } from '@socketsupply/tapzero'
// import { Identity } from '@ssc-hermes/identity'
import { createCryptoComponent } from '@ssc-hermes/node-components'
import { create } from '../dist/index.js'

test('create an envelope', async t => {
    const crypto = await createCryptoComponent()
    const envelope = await create(crypto, {
        username: 'alice',
        seq: 0
    })

    t.ok(envelope.signature, 'should create an envelope')
    t.equal(envelope.recipient, 'alice',
        'our username should be on the envelope')
})
