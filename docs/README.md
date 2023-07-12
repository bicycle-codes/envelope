
[ksSign](https://github.com/oddsdk/ts-odd/blob/main/src/components/crypto/implementation/browser.ts#L195) is exported as `keystore.sign`

* uses `rsaOperations.sign`
* `rsaOperations` comes from `keystore-idb`
* this leads to `keystore-idb/rsa/operations`

```ts
export async function sign(
  msg: Msg,
  privateKey: PrivateKey,
  charSize: CharSize = DEFAULT_CHAR_SIZE
): Promise<ArrayBuffer> {
  return webcrypto.subtle.sign(
    { name: RSA_WRITE_ALG, saltLength: SALT_LENGTH },
    privateKey,
    normalizeUnicodeToBuf(msg, charSize)
  )
}
```


--------------------------------------------------------------------


[keystoreAes.encryptBytes](https://github.com/fission-codes/keystore-idb/blob/main/src/aes/operations.ts#L7)

