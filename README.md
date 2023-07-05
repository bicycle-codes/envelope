# template ts ![tests](https://github.com/ssc-hermes/envelope/actions/workflows/nodejs.yml/badge.svg)

Envelopes that have been authorized by the recipient

---------------

__a send certificate__

Could be just a document signed by the recipient, like
```js
{
    seq: 0,
    expiration: '456',
    recipient: 'my-identity',
    signature: '123abc',
    author: 'did:key:abc'
}
```

```js
{ envelope: {...}, content: 'encrypted text' }
// sender ID is in the content, so that it is not readable except by the
//   recipient
```

Our server then needs to remember the latest sequence number it has seen. This works for a single server situation, but if there are mutliple intermediate nodes, then you could possibly reuse the certificates.

This is like using headers in http requests.

We need to be able to give someone our send certificates *privately*, without revealing the certificates to anyone else.

So if we assume we are doing this with internet ifrastructure (a server), then that means in the initial meeting, the server would be able to see who we are giving out certificates to. But in subsequent communication, the server would not know who we are talking to. You could give out the certificates via any means too, like on your website.

Certificates must be given out privately.
