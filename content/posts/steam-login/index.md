+++
date = '2021-01-07T15:37:01+01:00'
draft = false
title = "Steam's login method is kinda interesting"
tags = [ "steam", "rsa", "crypto", "webdev", "ssl", "tls", "javascript", "password", "https" ]
+++

I found a StackOverflow question from 2013 [asking how to securely send a password over HTTP](https://stackoverflow.com/questions/1582894/how-to-send-password-securely-over-http). The answers are pretty unanimous: get a SSL certificate. Here's an experiment: set up your favorite traffic-capturing proxy, browse to a service you frequently use, log in with your account (or preferably a throwaway), and inspect the requests. You will most certainly find that your username and password are sent as-is in a HTTP request body. The only reason this works is because your connection to the server is encrypted using TLS.

![StackOverflow user asking what to do if a webhost doesn't support SSL certificates, told to move to a real webhost](so-real-host.png)

The internet was a different place though in the early 2010s, let alone the many years prior. We now have services like [Let's Encrypt](https://letsencrypt.org/) which issue SSL certificates free of charge for a period of three months, with automatic renewals if desired. There really wasn't much of a way around acquiring a SSL certificate for money, but usually with extended validity and support. You could certainly argue that there is a price to be paid for the security and privacy of your users, but that didn't stop questions like the one I linked from appearing.

Now that we all agree that TLS is important, let's switch it up. Let's pretend we cannot send a password over HTTPS and have to somehow make it work with plain HTTP, while also providing users with some level of security. There's the `Authorization` header which is standardized and widely accepted. However, in conjunction with the "Basic" HTTP Authentication scheme, it provides no security if used in plain HTTP.

There are tried and tested challenge-response algorithms, most notably [SRP](https://en.wikipedia.org/wiki/Secure_Remote_Password_protocol) which is designed to do password-based authentication without ever actually sending the password, but you probably have to implement them yourself and a slight oversight could cause serious harm. You could also defer authentication to an external service. "Sign in with service XYZ" is commonly used, but comes with its own ramifications. All things considered, it's not trivial to send secrets over an inheretly insecure connection.

So when me and a friend took Steam apart in search for traces of personally identifiable information, I was surprised to see that Steam's login page doesn't only rely on TLS to ensure that your password stays protected.

## Crypto cherry on top

Again, grab your favorite traffic-capturing proxy and navigate to [Steam's login page](https://store.steampowered.com/login). Enter your username and password and you will (hopefully) be asked to enter a one-time token generated by your preferred two-factor authentication method. You can stop right there, because the magic I want to point out has already happened. You'll find that pressing the login button launches a request against an odd endpoint: `/login/getrsakey`, followed by `/login/dologin`.

![Requests to fetch script assets, acquire RSA key and perform login](getrsa-call.png)

Inspect the request for `/login/getrsakey` and you'll find a JSON-formatted response, containing fields with names that should look very familiar to anyone who's briefly dealt with public key cryptography. You're given a RSA public key, though the exact values might look a bit odd. It's clear that `publickey_mod` and `publickey_exp` define the modulus and the exponent used in encryption, but the former is given in hexadecimal while the latter appears to be given in binary (I'll get back on that later). There's also a timestamp which has no immediately recognizable starting point. As to what the purpose of `token_gid` is, I have no clue yet.

```json
{
  "success": true,
  "publickey_mod": "c85ba44d5a3608561cb289795ac93b34d4b9b4326f9c09d1d19a9923e2d136b8...",
  "publickey_exp": "010001",
  "timestamp": "1260462250000",
  "token_gid": "2701e0b0a4be3635"
}
```

The login page pulls some scripts on load. There is the main login handler contained in `login.js` which is completely unobfuscated, so anyone can just analyze it and find out what it does. The site also loads some additional dependencies, namely `jsbn.js` and `rsa.js`.

A quick search for the name mentioned in the first line of `jsbn.js` reveals that these two scripts are the work of [Tom Wu](http://www-cs-students.stanford.edu/~tjw/) --- a MIT and Stanford graduate who likes software engineering and computer cryptography. They released `jsbn.js` and `rsa.js` as pure JavaScript implementations of arbitrary precision integers and RSA encryption/decryption respectively. You'll also find that these libraries have had their most recent updates in 2005 and 2013 which is a bit of information I'll come back to later. For now, just keep it in mind.

## Going down the r(s)abbit hole

So now that we have all relevant assets, let's dig around in `login.js`. The code is a bit of a mess with lots of callbacks and proxied function calls, but it turns out the parts of interest can be easily condensed. In essence, the script can be boiled down to a couple of steps, each step assuming that everything went fine in the previous step.

1. The user enters their username and password and presses the login button.
2. `DoLogin` is called, which checks if the login mask was filled out correctly and launches a request against `/login/getrsakey`.
3. `OnRSAKeyResponse` is called. This checks if the response is well-formed.
4. `GetAuthCode` is called. It runs some platform-specific code in case there are any 2FA measures active on the user's account.
5. `OnAuthCodeResponse` is called. This is where the password is encrypted using RSA and the request against `/login/dologin` is prepared and executed.
6. `OnLoginResponse` is called. The user is logged in and redirected to the Steam storefront.

The code in `OnAuthCodeResponse` shows why the requested public key is formatted the way that it is. Starting at line 387 in the source file, the modulus and exponent of the `/login/getrsakey` response are passed as-is to the RSA library. The user's password is then encrypted with the given public key and added to the request against `/login/dologin` in the subsequent login step.

```js
var pubKey = RSA.getPublicKey(results.publickey_mod, results.publickey_exp);
var username = this.m_strUsernameCanonical;
var password = form.elements["password"].value;
password = password.replace(/[^\x00-\x7F]/g, ""); // remove non-standard-ASCII characters
var encryptedPassword = RSA.encrypt(password, pubKey);
```

I copied the source files onto my local machine to explore the RSA library a little bit. Both the modulus and the exponent are passed to the function `RSAPublicKey` which behaves like a constructor in the "pre-class" JavaScript era. `RSAPublicKey` simply wraps both values into instances of `BigInteger` provided by the `jsbn.js` script. It was to my surprise that the exponent is actually not represented in binary but, just like the modulus, in hexadecimal. (Also, turns out `0x010001` is a [very common encryption exponent](https://stackoverflow.com/questions/6098381/what-are-common-rsa-sign-exponent) in RSA implementations.) So now it's clear that the password encryption is based on 2048-bit RSA with an encryption exponent of 65537.

```js
let r = RSA.getPublicKey(
  "c85ba44d5a360856..." /* insert your own long modulus here */,
  "010001",
);
console.log(r.encryptionExponent.toString()); // => "65537"
console.log(r.modulus.bitLength()); // => 2048
```

Moving on to the `timestamp` field. The `/login/getrsakey` response contains an `Expires` header. It references a date in the past, meaning that the response is absolutely not meant to be cached or persisted in any way. If you check back on `/login/getrsakey` over a longer period of time, you'll notice that the public key changes ever so often and, as such, its timestamp value too. This means there's only a limited time frame in which a certain Steam-issued RSA public key can be used to authenticate.

This becomes even more evident when examining the subsequent request against `/login/dologin`. Among many other things, it contains the username, encrypted password as well as the timestamp of the issued RSA public key. Trying to perform a login attempt while altering the timestamp fails as expected. But more importantly, it's also not possible to reuse an older public key, even if the password is correctly encrypted.

I went one step further and [wrote a simple Python script to collect public keys](https://gist.github.com/JoogsWasTaken/8a8e60859e1721255c57e9185eb6cb10) over the span of three days using a throwaway account. I let it run every five minutes using a cronjob. The goal was to check just how often Steam's public keys change and to hopefully find out how the `timestamp` field behaves.

![SQLite database containing public keys sourced from Steam](sqlite-pubkeys.png)

I found that the public key changes every 12 entries, meaning that it's safe to assume that they rotate every hour. The encryption exponent stays the same --- no surprises here. More intriguing however is the aforementioned `timestamp` field. For every 12 public keys, the value of the `timestamp` increases by a certain amount, namely 3600000000 and then some. And what's more is that this number wraps around after some period of time as can be seen in the following image. Be warned, because all of what I'm about to say is highly speculative.

![Public key entries where the timestamp value wraps around in-between](sqlite-wraparound.png)

I found that 3600000000 microseconds is equal to one hour, making me assume that the value of the `timestamp` field is, in fact, given in microseconds. However, I already hinted at the fact that the timestamp value doesn't increase by one hour exactly with every new public key. In my own data, I observed that the difference between two successive timestamps is one hour plus 1 to 2.6 seconds, with most being in the order of about 1.05 to 1.25 seconds. But this raises another interesting possibility.

Let's assume that a new public key is generated every hour plus one second. If I query the public key endpoint precisely every five minutes (completely ignoring network latency for now), then there is a chance that I'm going to observe the same public key not 12 but 13 times in a row. This should happen whenever a request coincides with the generation of a new public key. Fortunately, since this is down to the second, the margin for error is actually not insanely small.

![Illustration of the edge case where the same public key is observed 13 times in a row](pubkey-edge-case.png)

After looking through my own dataset of public keys, I found that I hadn't caught this edge case. This may be bad luck or the fact that I'm merely spewing hypotheticals and hoping for a revelation of sorts. Additionally, with the varying increases in the timestamp values, it becomes hard to predict when exactly I could observe this edge case --- that is if there's even such a scenario.

But keep in mind, this difference in an hour and a second or two is **between** distinct public keys. Coming back to the assumption that a new public key is created every hour plus a second, then after 3600 public keys all these extra seconds will have added up to a full hour, leading to the edge case described in the previous paragraph. Now if this time difference occured between a full hour on the clock and the public key's timestamp, then this'd be a case closed and those extra seconds could be attributed to network latency. However, that's not the case with the data I collected thus far, and it's perplexing to say the least.

So to sum it all up: if all my assumptions so far have been correct, then the `timestamp` field and its time differences between public keys is incredibly puzzling. Is it to compensate for leap years? Is it due to some other sort of latency? Is it an implementation error that Valve just kinda went with? Is it not expressed in microseconds but rather something more arbitrary? Is it to keep nosy nerds like me scratching their heads? I'm leaning towards the latter.

I know I skipped over the weird wraparound in the `timestamp` field and I didn't even touch on the presumed purpose of the `token_gid` field. I believe the former is due to some technical restriction and the latter is presumably some CSRF mitigation or a unique identifier --- complete shots in the dark, since I already got more out of this endeavor than I initially anticipated. If you feel motivated to dig into this yourself and show off your findings, I'd appreciate it if you reached out to me, either via mail at the bottom of this site or on [Twitter](https://twitter.com/asciiowl).

One last thing worth noting is that querying the public key endpoint with different usernames yields different responses. Whether public keys are drawn from a pool and every user is assigned a different timestamp offset, or whether they're really generated on-the-fly, is up in the air. It is also possible to use any arbitrary username in the request against `/login/getrsakey`. It doesn't have to be registered with Steam. Do whatever you will with that information.

## Okay but ... why?

As I researched this topic, I became strangely enamored with Steam's login mechanism. I now know that, on top of using TLS (as they should) to sign in their users, they also use 2048-bit RSA to encrypt their user's passwords with some sort of rotating public key system which properly invalidates old keys and acts differently for every user. All this effort seems so redundant when a SSL certificate is all you realistically need to securely log in your users.

That begs the question why. Why bother creating such a weirdly intricate system on top of something that works just fine on its own? I have my own theory, but keep in mind it's just that.

Remember the release dates of the `BigInteger` and RSA libraries? Not only that, but the login page also sources jQuery version 1.8.3 [which was released in November 2012](https://blog.jquery.com/2012/11/13/jquery-1-8-3-released/). All this points to the simple fact that the login mechanism hasn't really changed for nearly a decade now. And just like I mentioned at the beginning of this post: the internet was a vastly different place back then.

![jQuery 1.8.3 changelog mistakenly reading "does'nt" instead of "doesn't"](jquery-typo.png)

"HTTPS everywhere" is an ongoing effort on the modern web, but it's been a long and painful process to get where we are today. My theory is that this was essentially Steam's effort at providing a layer of security for users back in the day who, by accident or by chance, didn't land on the SSL/TLS version of their login site. So even if a third party could sniff every bit of their data as it was sent to and from the Steam servers, they would at least have no way of knowing their password --- at least not without vast computational efforts.

I tried to reach out to a Valve employee who verifiably worked on the Steam storefront. I gave them a quick rundown of my analysis and my theory. I asked them if they could verify this or knew someone who was there when this login method was conceived. Of course, I know that someone who works at Valve has better things to do than to respond to a nerd's non-urgent, non-business inquiry. As of writing I'm still waiting for a response and I can only offer my own educated guess. Regardless, the journey up until here was a lot, and I mean a **lot**, of fun. There's still a bit of ground to cover and I'm definitely not done yet.

**Edit (2021/01/07):** In a previous version of this post, I assumed that the increase in the `timestamp` field was fixed for every new public key. I checked it again and found that this is not true, not even in the data I collected. (I got fooled by a long streak of increases by one hour and one minute.) This has been fixed.
