# envelope
![tests](https://github.com/bicycle-codes/envelope/actions/workflows/nodejs.yml/badge.svg)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@bicycle-codes/envelope)](https://socket.dev/npm/package/@bicycle-codes/envelope)
[![module](https://img.shields.io/badge/module-ESM-blue?style=flat-square)](README.md)
[![types](https://img.shields.io/npm/types/@bicycle-codes/envelope?style=flat-square)](README.md)
[![Common Changelog](https://nichoth.github.io/badge/common-changelog.svg)](./CHANGELOG.md)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![install size](https://flat.badgen.net/packagephobia/install/@bicycle-codes/envelope)](https://packagephobia.com/result?p=@bicycle-codes/envelope)
[![license](https://nichoth.github.io/badge/license-polyform-shield.svg)](LICENSE)

Envelopes that have been authorized by the recipient. This hides the sender's identity, while the recipient is still visible. This way we hide the *metadata* of who is talking to whom via private message. But, because the recipient is legible, we can still index messages by recipient.

This supports multiple devices by default because we are using the [Identity](https://github.com/bicycle-codes/identity) module.

Each envelope includes a signature. We want to give out our signed envelopes *privately*, without revealing them publicly.

If we assume we are doing this with internet infrastructure (ie, a server), then in the initial meeting the server would be able to see who we are giving out certificates to because the recipient must be visible. But in subsequent communication, the server would not know who we are talking to, they would just know that we are communicating with someone that we have given a certificate to.

You could also give out the certificates via some other means, like on your website, or via signal message, in which case the server would not know who it is from. Meaning, the server cannot even assume that a message is from your 'friend circle' in the application. It can only see that you got a message at a particular time; we can't infer anything about who it is from.

This is assuming that all the users of the app are well behaved, and not giving out envelopes willy nilly. :thinking:

## contents

<!-- toc -->

- [metaphors](#metaphors)
- [Identity](#identity)
- [an envelope](#an-envelope)
- [a message in an envelope](#a-message-in-an-envelope)
- [types](#types)
  * [Envelope](#envelope)
  * [EncryptedContent](#encryptedcontent)
- [API](#api)
  * [create](#create)
  * [wrapMessage](#wrapmessage)
  * [decryptMessage](#decryptmessage)
  * [verify](#verify)

<!-- tocstop -->

## metaphors
If we stick with comparisons to common physical activities, this is very similar to the postal service. The envelope shows the recipient, and it needs a stamp (the signature here), but it hides the sender's ID.

## Identity
The envelopes and encrypted messages pair with an [identity instance](https://github.com/bicycle-codes/identity) instance on your device.

We create a symmetric key and encrypt it to various "exchange" keys. The exchange keys are non-extractable key pairs that can only be used on the device where they were created.

That way the documents created by this library can be freely distributed without leaking any keys.

## an envelope
Just a document signed by the recipient, like this:

```js
// envelope
{
    seq: 0,
    expiration: 456,
    recipient: 'my-username',
    signature: '123abc',
    author: 'did:key:abc'
}
```

## a message in an envelope

```js
// the message
{ envelope, content: 'encrypted text' }
// sender ID is in the content, so it is only readable by
//   the recipient
```

## types

### Envelope
```ts
import type { SignedMessage } from '@bicycle-codes/message'

export type Envelope = SignedMessage<{
    seq:number,
    expiration?:number,  // default to 0, which means no expiration
    recipient:string,  // the recipient's username
}>
```

### EncryptedContent
When you encrypt a string, we create a record of keys. The `key` object is a map from device name to a symmetric key that has been encrypted to the device. We do it this way because each device has its own keypair. We use the symmetric key to encrypt the content.

```ts
interface EncryptedContent {
    key:Record<string, string>,  // { deviceName: 'encrypted-key' }
    content:string  // encrypted text
}
```

## API

### create
Create an envelope.

```ts
async function create (
    // crypto:Implementation,
    signingKeypair:CryptoKeyPair,
    {
        username,
        seq,
        expiration = 0  // no expiration by default
    }:{ username:string, seq:number, expiration?:number }
):Promise<Envelope>
```

### wrapMessage
Create a new AES key, take an envelope and some content. Encrypt the content, then put the content in the envelope.

This will encrypt the AES key to every device in the recipient identity, as well as your own identity.

```ts
import { Identity } from '@bicycle-codes/identity'

async function wrapMessage (
    me:Identity,
    recipient:Identity,  // because we need to encrypt the message to the recipient
    envelope:Envelope,
    content:Content
):Promise<[{
    envelope:Envelope,
    message:EncryptedContent
}, Keys]>
```

This returns an array of
```js
[{ envelope, message: encryptedMessage }, { ...senderKeys }]
```

> [!NOTE]
> __We return the sender keys as a seperate object__ because we *do not* want the sender's device names to be in the message that gets sent, because that would leak information about who the sender is.

The sender could save a map of the message's hash to the returned key object. That way they can save the map to some storage, and then look up the key by the hash of the message object.

### decryptMessage
Decrypt a given message. Depends on having the right `crypto` object. Return a `Content` object:
```ts
type Content = SignedRequest<{
    from:{ username:string },
    text:string,
    mentions?:string[],
}>

export async function decryptMessage (
    crypto:Crypto.Implementation,
    msg:EncryptedContent
):Promise<Content>
```

#### example
```ts
import { decryptMessage } from '@bicycle-codes/envelope'

const decrypted = await decryptMessage(alicesCrypto, msgContent)

console.log(decrypted.from.username)
// => bob
console.log(decrypted.text)
// => hello
```

#### Decrypt a message that I wrote
Pass in the keys as a separate argument if you are the message author. The
sender's keys are not in the message evnelope, because we need to keep your
device names out of the unencrypted envelope.

```js
import { decryptMessage } from '@bicycle-codes/envelope'

// bobs keys were not in the envelope, because doing so would
// reveal information about the message author, Bob.
const decrypted = await decryptMessage(bobsCrypto, msgContent, bobsKeys)

console.log(decrypted.from.username)
// => bob
console.log(decrypted.text)
// => hello
```

### verify
Check if a given envelope is valid. `currentSeq` is an optional sequence number to use when checking the validity. If `currentSeq` is less than or equal to `seq` in the `envelope`, then this will return `false`.

```ts
function verify (envelope:Envelope, currentSeq?:number):Promise<boolean>
```

```ts
test('check that the envelope is valid', async t => {
    const isValid = await verify(alicesEnvelope)
    t.equal(isValid, true, 'should validate a valid envelope')

    t.equal(await verify(alicesEnvelope, 0), true,
        'should take a sequence number')

    t.equal(await verify(alicesEnvelope, 1), false,
        'should say a message is invalid if the sequence number is equal')

    try {
        t.equal(await verify('baloney'))
    } catch (err) {
        t.ok(err, 'should throw given a malformed message')
    }
})
```

----------------------------------

**:question:question**

You would need to do multi-device sync with the map of msg -> keys though. How do you sync multiple devices without leaking information about who wrote the message?

You could encrypt the document of `msg -> keys`, and not check identity when you serve requests. If an unauthorized person requests the keys for a given username, they would not be able to decrypt them, so the server does not need to know who you are.

----------------------------------

The symmetric key for the recipient is in the encrypted message content. The premise is that the recipient will have a [keystore](https://github.com/fission-codes/keystore-idb) instance locally, and will use their local private key to decrypt the symmetric key in the message, then use that symmetric key to decrypt this message content.

We use a two step decryption like that because we are supporting multi-device use. If someone has a handful of devices, then the symmetric key will be encrypted to each device separately, so there are no shared keys.

----------------------

Thanks to @Dominic for sketching this idea.
