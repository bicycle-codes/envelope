## @nichoth
__(original post)__
If anyone wants to think about a puzzle

This one is stuck in my mind lately — scalable private messages.

So we have a set of all users. When one user writes a private message to another user, the message content, + the sender are encrypted, but the recipient is readable. So that way the recipient can ask a query like "give me any private messages addressed to *alice*", and we are able to index messages based on recipient.

The sender of the message is encrypted, because otherwise it would leak information about who is sending messages to whom.

*However*, we want to know if the sender is in the set of total users, because we don't want to just store random garbage messages. So we need to check if the sender is a member of the set of users, without revealing *who* they are.

This seems like a scenario that zero knowledge people would have fun with. I have been searching the term "zero knowledge proof of set membership". I don't know if I will ever see a solution though. This is the same issue with ssb private messages BTW. A pub would want to check if the sender of a message is within the set of users within its two-hop network view, without learning who the user is. Maybe this is not possible. I don't know enough about this domain to say either way.



## @Dominic

It is possible to do a ZKP of a set membership, but it's quite expensive to generate proofs, and fairly expensive to check them too, compared to even asymmetric crypto.

Anyway, here is a my sketch for how you could do this using conventional crypto.

As you point out, you need some sort of sender authorization, to prevent spam.
A relaying peer/server needs to know if the sender is allowed to send to this recipient, but without revealing who they actually are.

So, in the ordinary postal system, you write my name and address on an envelope and send it to me. This enables unsolicited mail. But suppose we only allow mail in envelopes that have already been authorized by the sender?

So, I give you a one-time private key, plus i sign a statement that says the corresponding public key is allowed to post me a message, before some expiry time. You could call this a "send certificate". It's one per message. So I send you several at a time, so you can send me say 20 messages.

You encrypt your message to me, then sign it with the private key in the send cert, then broadcast the cyphertext, signature, send cert and recipient. A relaying peer checks that cert has not expired, and is actually **signed by the recipient**, and that **the cyphertext is signed by the key in the cert.**

The relay servers don't need to keep track of certs that have not been used yet, they just need to remember if they have already seen certs. Actually, it doesn't matter if they do this perfectly. Reusing a cert reveals the sender, so well behaved senders won't do that. I would have relays remember certs, but only use a bounded amount of memory for that. Relays can forget about certs that have reached their expiry date! Relays only need to remember the hash of the cert and it's expiry date, so it's not even much information. They could keep a bloom filter to it's easy to test the usual case that it's a unique single use of the cert.

The recipient doesn't even need to remember who they gave the certs to. They just receive a message, see that they signed the cert, decrypt the cyphertext and that contains the actual sender.

I think this would probably be more efficient than a zero knowledge system.


## @nichoth

thanks [@Dominic](@EMovhfIrFk4NihAKnRNhrfRaqIhBv1Wj8pTxJNgvCCY=.ed25519)!

I'm going to try restating things.

Alice wants to send a message to Bob, and Alice has been given a *send certificate* already, which is a message signed by Bob, the recipient, and it includes a key. The relaying nodes keep track of certificates they have seen already, so if they get a repeat they can just ignore it.

When Alice sends Bob a message, Alice encrypts the message content, including Alice's own name, *to* Bob. Then Alice signs the encrypted message with the key in the certificate. That way an intermediate node can verify that the message is legitimate because it is signed by a real certificate, but they don't know who the message is coming from. Then Alice sends the message + certificate. An intermediate node sees the incoming message, and it is a certificate they have not seen before, so the node stores/delivers the message. The node can see the message is addressed to Bob, because of the certificate.

And Bob doesn't get spam because Bob has only given certificates to people he wants to hear from.

-----------------

Bob could give several certificates to each of their friends, that way it at least obscures communication to within Bob's circle of friends. That is, if Bob is receiving a private message, all you could know about it is that it is from a friend of Bob, but you can't pinpoint the sender any more than that. 

---------------------

__How does Bob give out the certificates?__
We need to encrypt a message to Alice, because we need the signing key to be private. If we keep the constraint that the recipient is visible, then that means we can see who Bob is friends with. But, if Bob gives out certificates to each of his friends, then we don't know exactly who Bob is talking to in future DMs.


## @Dominic

correct!
There are lots of ways that peers can initially exchange send-certs. they can meet in person. bob could have a public presense (aka a website) that has a “request a send cert” button, this would obviously be rate limited etc. alice could also forward one of her send certs for bob to carol, to introduce c to b. This scheme would have all the affordances of email, except revealing the sender and enabling unlimited peers to send you messages
