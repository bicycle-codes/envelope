import {
    verify as verifyMsg,
    create as createMsg,
} from '@bicycle-codes/message'
import type { SignedMessage } from '@bicycle-codes/message'
import {
    DEFAULT_SYMM_LEN,
    DEFAULT_SYMM_ALGORITHM
} from '@bicycle-codes/crypto-util/constants'
import {
    create as aesGenKey,
    encrypt as aesEncrypt,
    decrypt as aesDecrypt,
} from '@bicycle-codes/crypto-util/webcrypto/aes'
import {
    Identity,
    encryptKey,
} from '@bicycle-codes/identity'
import { rsaOperations } from '@bicycle-codes/identity/util'
import { fromString } from '@bicycle-codes/crypto-util'
import serialize from 'json-canon'

//
// {
//     seq: 0,
//     expiration: '456',
//     recipient: 'my-identity',
//     signature: '123abc',
//     author: 'did:key:abc'
// }
//

export const ALGORITHM = DEFAULT_SYMM_ALGORITHM

export type Envelope = SignedMessage<{
    seq:number,
    expiration:number,
    recipient:string,  // the recipient's username
}>

// map of device name to encrypted key string
export type Keys = Record<string, string>

type Content = SignedMessage<{
    from:{ username:string },
    text:string,
    mentions?:string[],
}>

export interface EncryptedContent {
    // The key, encrypted to the recipient
    key:Record<string, string>,  // { myDeviceName: 'encrypted-key' }
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
 * @returns {[{ envelope:Envelope, message:EncryptedContent }, Keys]}
 *
 * Return an array of [message, keys], where keys is a map of the sender's devices
 * to the symmetric key encrypted to that device. This is returned as a separate
 * object because we *don't* want the sender device names to be in the message.
 */
export async function wrapMessage (
    me:Identity,
    recipient:Identity,  // we need to encrypt the message to the recipient
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
    const key = await aesGenKey({ alg: ALGORITHM, length: DEFAULT_SYMM_LEN })
    // encrypt the key to the recipient,
    // also encrypt the content with the key
    const encryptedContent = await encryptContent(
        key,
        serialize(content),
        recipient
    )

    return [
        {
            envelope,
            message: encryptedContent,
        },
        await encryptKeys(me, key)]
}

/**
 * Pass in keys, if you are the message author, and thus your keys would not
 * be in the message. If you are the recipient, then your key is in the message.
 *
 * @param {CryptoKeyPair} keypair The decrypter's keys
 * @param {EncryptedContent} msg The message to decrypt
 * @param {Record<string, string>} [keys] The message author's keys
 * @returns {Promise<Content>}
 */
export async function decryptMessage (
    id:InstanceType<typeof Identity>,
    msg:EncryptedContent,
    keys?:Record<string, string>
):Promise<Content> {
    if (keys) {
        const { deviceName } = id
        const encryptedKey = keys[deviceName]
        const decryptedKey = await rsaOperations.decrypt(
            encryptedKey,
            id.encryptionKey.privateKey
        )

        const decryptedMsg = await aesDecrypt(
            msg.content,
            decryptedKey,
            ALGORITHM
        )

        return JSON.parse(decryptedMsg)
    }

    const deviceName = id.deviceName
    const encryptedKey = msg.key[deviceName]
    const decryptedKey = await rsaOperations.decrypt(
        encryptedKey,
        id.encryptionKey.privateKey
    )

    const decrypted = await aesDecrypt(
        fromString(msg.content),
        decryptedKey,
        ALGORITHM
    )

    return (JSON.parse(decrypted))
}

/**
 * Create an envelope -- a certificate. Return a signed certificate object
 *
 * @param crypto odd crypto object
 * @param {{ username:string, seq:number, expiration?:number }} opts
 *   username: your username (the recipient)
 *   seq: an always incrementing integer
 *   expiration: timestamp to expire, default is 0, which means no expiration
 * @returns {Promise<Envelope>} A serizlizable certificate
 */
export async function create (
    // crypto:Implementation,
    signingKeypair:CryptoKeyPair,
    {
        username,
        seq,
        expiration = 0  // no expiration by default
    }:{ username:string, seq:number, expiration?:number }
):Promise<Envelope> {
    const envelope = await createMsg(signingKeypair, {
        seq,
        expiration,
        recipient: username  // our username goes on the envelope
    })

    return envelope
}

/**
 * Take data in string format, and encrypt it with the given symmetric key.
 *
 * @param key The symmetric key used to encrypt/decrypt
 * @param data The text to encrypt
 * @returns {Promise<{ key:Keys, content:string }>}
 */
export async function encryptContent (
    key:CryptoKey,
    data:string,
    recipient:InstanceType<typeof Identity>
):Promise<{ key:Keys, content:string }> {
    const encrypted = await aesEncrypt(data, key)
    const encryptedKeys = await encryptKeys(recipient, key)

    return {
        key: encryptedKeys,
        content: encrypted
    }
}

/**
 * Check if an envelope is valid or not. Checks the signature and expiration,
 *   and optionally a sequence number.
 * @param {Envelope} envelope An envelope
 * @param {number} [currentSeq] The last sequence number [optional]
 * @returns {Promise<boolean>}
 */
export function verify (envelope:Envelope, currentSeq?:number):Promise<boolean> {
    if (currentSeq !== undefined) {
        if (envelope.seq <= currentSeq) return Promise.resolve(false)
    }

    if (isExpired(envelope)) return Promise.resolve(false)

    return verifyMsg(envelope)
}

/**
 * Check if this envelope has expired. An expiration of 0 means
 * it does not expire
 * @param {Envelope} envelope An envelope
 * @returns {boolean}
 */
export function isExpired (envelope:Envelope):boolean {
    return (!!envelope.expiration && Date.now() > envelope.expiration)
}

/**
 * Take a given AES key and encrypt it to all the devices in the given identity.
 * @param id The identity we are encrypting to
 * @param key The key we are encrypting
 * @returns {Record<string, string>}
 */
async function encryptKeys (id:Identity, key:CryptoKey):Promise<Keys> {
    const encryptedKeys = {}
    for await (const deviceName of Object.keys(id.devices)) {
        const exchange = id.devices[deviceName].encryptionKey
        encryptedKeys[deviceName] = await encryptKey(key, exchange)
    }

    return encryptedKeys
}
