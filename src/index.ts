import { create as createMsg, SignedRequest } from '@ssc-hermes/message'
import { fromString, toString } from 'uint8arrays'
import { Crypto } from '@oddjs/odd'
import { SymmAlg } from 'keystore-idb/types.js'
import { writeKeyToDid } from '@ssc-hermes/util'
import {
    aesGenKey,
    aesEncrypt,
    aesDecrypt,
    // rsaDecrypt
} from '@oddjs/odd/components/crypto/implementation/browser'
import { Identity, encryptKey, createDeviceName } from '@ssc-hermes/identity'
import serialize from 'json-canon'

// {
//     seq: 0,
//     expiration: '456',
//     recipient: 'my-identity',
//     signature: '123abc',
//     author: 'did:key:abc'
// }

export const ALGORITHM = SymmAlg.AES_GCM

export type Envelope = SignedRequest<{
    seq:number,
    expiration:number,
    recipient:string,  // the recipient's username
}>

// map of device name to encrypted key string
type Keys = Record<string, string>

type Content = SignedRequest<{
    from:{ username:string },
    text:string,
    mentions?:string[],
}>

export interface EncryptedContent {
    key:Record<string, string>,  // { deviceName: 'encrypted-key' }
    content:string
}

/**
 * Encrypt a string and put it into an envelope. The envelope tells us who the
 * recipient of the message is; the message sender is hidden.
 * @param me Your Identity.
 * @param recipient The identity of the recipient, because we need to encrypt
 * the message to the recipient.
 * @param envelope The envelope we are putting it in
 * @param content The content that will be encrypted to the recipient
 * @returns [message, <sender's keys>]
 * Return an array of [message, keys], where keys is a map of the sender's devices
 * to the symmetric key encrypted to that device. This is returned as a seperate
 * object because we *don't* want the sender device names to be in the message.
 */
export async function wrapMessage (
    me:Identity,
    recipient:Identity,  // because we need to encrypt the message to the recipient
    envelope:Envelope,
    content:Content
):Promise<[{
    envelope:Envelope,
    message:EncryptedContent
}, Keys]> {
    // encrypt the content *to* the recipient,
    // use an Identity to get the exchange keys of all the devices
    //   of the recipient

    // create a key
    const key = await aesGenKey(ALGORITHM)
    // encrypt the key to the recipient,
    // also encrypt the content with the key
    const encryptedContent = await encryptContent(key, serialize(content),
        recipient)

    return [
        {
            envelope,
            message: encryptedContent,
        },
        await encryptKeys(me, key)]
}

export async function decryptMessage (
    crypto:Crypto.Implementation,
    msg:EncryptedContent
):Promise<Content> {
    const did = await writeKeyToDid(crypto)
    const deviceName = await createDeviceName(did)

    const encryptedKey = msg.key[deviceName]

    const decryptedKey = await crypto.keystore.decrypt(
        fromString(encryptedKey, 'base64pad')
    )

    const decrypted = await aesDecrypt(
        fromString(msg.content, 'base64pad'),
        decryptedKey,
        ALGORITHM
    )

    return (JSON.parse(new TextDecoder().decode(decrypted)))
}

/**
 * Create an envelope -- a certificate. Return a signed certificate object
 * @param crypto odd crypto object
 * @param {{ username:string, seq:number, expiration?:number }} opts
 *   username: your username (the recipient)
 *   seq: an always incrementing integer
 *   expiration: timestamp to expire, default is 1 year from now
 * the sequence number to use for this envelope
 * @returns {Promise<Envelope>} A serizlizable certificate
 */
export async function create (crypto:Crypto.Implementation, {
    username,
    seq,
    // expire 1 year from now by default
    expiration = new Date().setFullYear(new Date().getFullYear() + 1)
}:{ username:string, seq:number, expiration?:number }):Promise<Envelope> {
    const envelope = await createMsg(crypto, {
        seq,
        expiration,
        recipient: username  // our username goes on the envelope
    })

    return envelope
}

/**
 * Take data in string format, and encrypt it with the given symmetric key.
 * @param key The symmetric key used to encrypt/decrypt
 * @param data The text to encrypt
 * @returns {Promise<{ key:Keys, content:string }>}
 */
export async function encryptContent (
    key:CryptoKey,
    data:string,
    recipient:Identity
):Promise<{ key:Keys, content:string }> {
    const encrypted = arrToString(await aesEncrypt(
        new TextEncoder().encode(data),
        key,
        ALGORITHM
    ))

    const encryptedKeys = await encryptKeys(recipient, key)

    return {
        key: encryptedKeys,
        content: encrypted
    }
}

/**
 * Take a given AES key and encrypt it to all the devices in the given identity.
 * @param id The identity we are encrypting to
 * @param key The key we are encrypting
 * @returns {Record<string, string>}
 */
async function encryptKeys (id:Identity, key:CryptoKey):
Promise<Keys> {
    const encryptedKeys = {}
    for await (const deviceName of Object.keys(id.devices)) {
        const exchange = id.devices[deviceName].exchange
        encryptedKeys[deviceName] = await encryptKey(key, arrFromString(exchange))
    }

    return encryptedKeys
}

function arrFromString (str:string) {
    return fromString(str, 'base64pad')
}

function arrToString (arr:Uint8Array) {
    return toString(arr, 'base64pad')
}
