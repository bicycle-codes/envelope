import { test } from '@socketsupply/tapzero'
import { create as createId, Identity } from '@ssc-hermes/identity'
import { createCryptoComponent } from '@ssc-hermes/node-components'
import { Crypto } from '@oddjs/odd'
import {
    create as createEnvelope,
    Envelope,
    wrapMessage,
    EncryptedContent,
    decryptMessage
} from '../dist/index.js'
import { create as createMsg } from '@ssc-hermes/message'

let alicesEnvelope:Envelope
let alice:Identity
let alicesCrypto:Crypto.Implementation

test('create an envelope', async t => {
    alicesCrypto = await createCryptoComponent()
    alice = await createId(alicesCrypto, { humanName: 'alice' })
    alicesEnvelope = await createEnvelope(alicesCrypto, {
        username: alice.username,
        seq: 0
    })

    t.ok(alicesEnvelope.signature, 'should create an envelope')
    t.equal(alicesEnvelope.recipient, alice.username,
        "alice's username should be on the envelope")
})

// let alicesKeys:Record<string, string>
let msgContent:EncryptedContent
let bob:Identity

test('put a message in the envelope', async t => {
    const bobsCrypto = await createCryptoComponent()
    bob = await createId(bobsCrypto, { humanName: 'bob' })

    const content = await createMsg(bobsCrypto, {
        from: { username: bob.username },
        text: 'hello'
    })

    const [
        { envelope: returnedEnvelope, message },  // the encrypted message content
        keys  // map of sender's device name to encrypted key string
    ] = await wrapMessage(bob, alice, alicesEnvelope, content)

    msgContent = message

    t.ok(returnedEnvelope, 'should return the envelope')
    t.equal(returnedEnvelope.signature, alicesEnvelope.signature,
        'the envelope we get back shoud be equal to what was passed in')
    t.ok(message, 'should return the encrypted content')
    t.ok(keys, 'should return keys')

    // console.log('**msg**', message)
})

test('alice can decrypt a message addressed to alice', async t => {
    const decrypted = await decryptMessage(alicesCrypto, msgContent)
    t.equal(decrypted.from.username, bob.username,
        "should have bob's username in decrypted message")
    t.equal(decrypted.text, 'hello', 'should have the original text of the message')
})

test("carol cannot read alice's message", async t => {
    const carolsCrypto = await createCryptoComponent()
    try {
        await decryptMessage(carolsCrypto, msgContent)
        t.fail('should throw with the wrong keys')
    } catch (err) {
        t.ok(err, 'should throw if we use the wrong keys')
    }
})
