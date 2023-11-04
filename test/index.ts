import { test } from '@nichoth/tapzero'
import { create as createId, Identity } from '@ssc-half-light/identity'
import { createCryptoComponent } from '@ssc-hermes/node-components'
import { Crypto } from '@oddjs/odd'
import {
    create as createEnvelope,
    verify,
    Envelope,
    wrapMessage,
    EncryptedContent,
    decryptMessage,
    Keys
} from '../dist/index.js'
import { create as createMsg } from '@ssc-half-light/message'

let alicesEnvelope:Envelope
let alice:Identity
let alicesCrypto:Crypto.Implementation

test('create an envelope', async t => {
    alicesCrypto = await createCryptoComponent()
    alice = await createId(alicesCrypto, { humanName: 'alice' })
    alicesEnvelope = await createEnvelope(alicesCrypto, {
        username: alice.username,
        seq: 1
    })

    t.equal(alicesEnvelope.seq, 1, 'should have sequence number 0')
    t.ok(alicesEnvelope.signature, 'should create an envelope')
    t.equal(alicesEnvelope.expiration, 0, 'should have 0 expiration by defualt')
    t.equal(alicesEnvelope.recipient, alice.username,
        "alice's username should be on the envelope")
})

let msgContent:EncryptedContent
let bob:Identity

let bobsCrypto:Crypto.Implementation
let bobsKeys:Keys
test('put a message in the envelope', async t => {
    bobsCrypto = await createCryptoComponent()
    bob = await createId(bobsCrypto, { humanName: 'bob' })

    const content = await createMsg(bobsCrypto, {
        from: { username: bob.username },
        text: 'hello'
    })

    const [
        { envelope, message },  // the encrypted message content
        keys  // map of sender's device name to encrypted key string
    ] = await wrapMessage(bob, alice, alicesEnvelope, content)

    bobsKeys = keys

    msgContent = message

    t.ok(envelope, 'should return the envelope')
    t.ok(Object.keys(keys).includes(Object.keys(bob.devices)[0]),
        "should include bob's device name in the keys object")
    t.equal(envelope.signature, alicesEnvelope.signature,
        'the envelope we get back shoud be equal to what was passed in')
    t.ok(message, 'should return the encrypted content')
    t.ok(keys, 'should return keys')
})

test('check that the envelope is valid', async t => {
    t.plan(4)
    const isValid = await verify(alicesEnvelope)
    t.equal(isValid, true, 'should validate a valid envelope')

    t.equal(await verify(alicesEnvelope, 0), true,
        'should take a sequence number')

    t.equal(await verify(alicesEnvelope, 1), false,
        'should say a message is invalid if the sequence number is equal')

    try {
        // @ts-ignore
        await verify('baloney')
    } catch (err) {
        t.ok(err, 'should throw given a malformed message')
    }
})

test('alice can decrypt a message addressed to alice', async t => {
    const decrypted = await decryptMessage(alicesCrypto, msgContent)
    t.equal(decrypted.from.username, bob.username,
        "should have bob's username in decrypted message")
    t.equal(decrypted.text, 'hello', 'should have the original text of the message')
})

test('bob can decrypt a message that he created', async t => {
    const decrypted = await decryptMessage(bobsCrypto, msgContent, bobsKeys)
    t.ok(decrypted, 'should decrypt without error')
    t.equal(decrypted.from.username, bob.username,
        'can read the decrypted text')
    t.equal(decrypted.text, 'hello', 'can read decrypted text')
})

test("carol cannot read alice's message", async t => {
    t.plan(1)
    const carolsCrypto = await createCryptoComponent()

    try {
        await decryptMessage(carolsCrypto, msgContent)
        t.fail('should throw with the wrong keys')
    } catch (err) {
        t.ok(err, 'should throw if we use the wrong keys')
    }
})
