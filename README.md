# envelope ![tests](https://github.com/ssc-hermes/envelope/actions/workflows/nodejs.yml/badge.svg)

Envelopes that have been authorized by the recipient. This hides the sender's identity.

Our server needs to remember the latest sequence number it has seen. This works for a single server situation, but if there are mutliple intermediate nodes, then it would be possible to reuse the certificates by passing the same sequence number to multiple intermediate nodes.

Is that an attack vector? The recipient of the message can verify who wrote the content, so it would not be possible to spoof the content of the message. The recipient can check if the sender is someone they expect.

We want to give out our send certificates *privately*, without revealing them publicly. Although, we are still able to verify the identity of the message sender.

If we assume we are doing this with internet infrastructure (a server), then in the initial meeting the server would be able to see who we are giving out certificates to because the recipient must be visible. But in subsequent communication, the server would not know who we are talking to, they would just know that we are communicating with someone that we have given a certificate to.

You could also give out the certificates via other means, like on your website, or via signal message, in which case the server would not know who it is from. Meaning, the server cannot even assume that a message is from your 'friend circle' in the application. It can only see that you got a message at a particular time.

## keystore
The envelopes and encrypted messages created by this library pair with a [keystore](https://github.com/fission-codes/keystore-idb) instance on your device.

We create a symmetric key and encrypt it to various "exchange" keys. The exchange keys are non-extractable key pairs that can only be used on the device where they were created.

That way the documents created by this library can be freely distributed without leaking any keys.

## API

### types

#### Envelope
```ts
import { SignedRequest } from '@ssc-hermes/message'

export type Envelope = SignedRequest<{
    seq:number,
    expiration:number,
    recipient:string,  // the recipient's username
}>
```

#### EncryptedContent
When you encrypt a string, we create a record of keys. The `key` object is a map from device name to a symmetric key that has been encrypted to the device. We do it this way because each device has its own keypair. We use the symmetric key to encrypt the content.

```ts
interface EncryptedContent {
    key:Record<string, string>,  // { deviceName: 'encrypted-key' }
    content:string  // encrypted text
}
```

### create
Create an envelope.

```ts
(crypto:Crypto.Implementation, {
    username,
    seq,
    // expire 1 year from now by default
    expiration = new Date().setFullYear(new Date().getFullYear() + 1)
}:{ username:string, seq:number, expiration:number }) => Promise<Envelope>
```

### wrapMsg
Take an envelope and some content, and encrypt the content, then put it in the envelope. This returns an array of `[{ ...yourMessage }, { ...sendersKeys }]`

We return the sender keys as a seperate object because we *do not* want the sender's device names to be in the message that gets sent.

You could save a map of the hash of the message to the returned key object. That way you can save the map to some storage, then you can look up the key by the hash of the message object.

```ts
export async function wrapMsg (
    me:Identity,
    recipient:Identity,
    envelope:Envelope,
    content:Content
):Promise<[{
    envelope:Envelope,
    message:EncryptedContent
}, Record<string, string>]> {
```

---------------

__a send certificate__

Could be just a document signed by the recipient, like
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

```js
// the message
{ envelope, content: 'encrypted text' }
// sender ID is in the content, so that it is only readable by the recipient
```

----------------------

We send along the cert with the message. The relaying peer can **check that the cert was created by the recipient**.
