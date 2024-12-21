+++
title = 'When an app breaks after ten years of service'
date = 2024-12-21T21:01:31+01:00
draft = false
tags = [ "webdev", "php", "coding", "review", "code", "analysis", "app", "web", "webapp", "cookie", "security", "cybersecurity", "hash", "hashing", "salt", "sha" ]
+++

It's not often that I get e-mails that truly surprise me.
A while back I received an e-mail from a teacher of the school I used to go to.
He said that the web app that I programmed back then to present the school's substitution plans suddenly stopped working and was asking for a password.
Apparently the teachers installed a tablet in the staff room which had the app open at all times so they could stay up-to-date.
He was wondering whether I still knew the password or, if I didn't, whether I could generate a new one.

I had to let that sink in for a long time.
I rolled out the web app back in 2013 when I was starting in 10<sup>th</sup> grade.
I graduated in 2016 and left behind documentation on how to maintain the web app.
[I published a blog post in 2021 where I dissected the source code of the web app and open-sourced it for posterity.]({{< ref "/posts/vpmobil" >}})
And in that moment I realized that the web app worked **flawlessly for over ten years**.

I was overjoyed, but I was also laughing at how silly this was.
The implications were that, during these ten years, my school still didn't have an official and sensible way of presenting their substitutions plans at my former school.
There was still no better way than to use my web app.
And from the way the e-mail was worded, I could tell that the web app was something the teachers kept to themselves.
What started as a project to help my fellow students back then ... oh well ...

Regardless, I had a whole write-up and the source code of my web app available to myself so I could find out why it was suddenly asking for a password.
If you want more details, then I highly recommend checking out the post that I mentioned and linked earlier.
The source code is a treasure trove that makes me smile and cringe at the same time.

Essentially, upon visiting the web app, users would be prompted to enter a single password that was supposed to be distributed to all staff and students at the start of the school year.
The password was stored as a basic salted hash in a file on the server.
When the user entered a password, the server would check if hashing it with the same salt used for the correct password would yield the correct hash.
If this check passes, the following function would be called to set an authentication cookie on the user's client.

```php
// Sets a cookie that "never" expires. The actual expiration date is
// 10 years in the future which means that the password will have been
// changed at least once during that time.
function set_cookie_no_expire($key, $value) {
    setcookie($key, $value, strtotime("+10 years"), "/");
}
```

The irony in the comment for this function speaks for itself.

I received the e-mail in 2023.
This means that some teacher set up the tablet in the staff room in 2013, signed in with the correct password at the time, and just let it run until the cookie expired.
None of the staff consulted the documentation to check how to create a new password, nor did they think it was necessary to do so during all that time.

Arguably, a part of the blame is also on me because back then I used a now deprecated and ancient tool for creating the file that stored the salted hash on the server.
The teacher who reached out to me also attached the documentation I wrote to his e-mail.
I was so wrapped up in my technical know-how back then that I never considered how a person with no technical background might interpret the instructions that I left behind --- if they even understood them at all, that is.
In my defense, my 10<sup>th</sup>-grade self didn't know any better.

I replied to that e-mail by sending a new password, the corresponding hashed password file and a small script so they could generate a new password in another ten years from now themselves, this time with instructions that should make sense to a non-techie.
I also wrote a couple paragraphs saying how happy it made me to hear that my web app was still in use and cherished for its usefulness.
It's a rare feeling to know that one of my projects is truly "done" and keeps existing without my interference.

Maybe I am a bit good at this programming thing.
