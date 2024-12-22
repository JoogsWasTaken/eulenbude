+++
date = '2023-11-02T12:23:01+01:00'
draft = false
title = 'Becoming one in a million by giving up your data'
description = "So far, all posts that dealt with niche aspects of my master thesis were all about the methods of privacy-preserving record linkage (PPRL), the attacks one can run on them and some interesting software engineering bits here and there. However I spent very little time covering what makes data linkable in the first place."
tags = ["cybersec", "privacy", "pprl", "security", "infosec", "python", "linkage", "record", "data", "science", "database", "postgres", "pgsql", "postgresql", "analysis"]
+++

> This post is part of a series on Bloom filter based privacy-preserving record linkage.
> If you're new to this series, then I highly recommend you read the first post as a primer on what you're getting yourself into.
>
> - [Find duplicates in your datasets with this one weird data structure]({{< ref "/posts/bf-pprl-intro" >}})
> - [You show me your bits, I show you who you are]({{< ref "/posts/bf-pprl-attacks" >}})
> - [How to count bits at the speed of light]({{< ref "/posts/bf-popcnt" >}})
> - **[Becoming one in a million by giving up your data]({{< ref "/posts/bf-ncvr" >}})**

So far, all posts that dealt with niche aspects of my master thesis were all about the methods of privacy-preserving record linkage (PPRL), the attacks one can run on them and some interesting software engineering bits here and there.
However I spent very little time covering what makes data linkable in the first place.

PPRL still has to deal with the same challenges that classic record linkage does, namely the selection of strong pieces of personal information and weighing them up against one another.
While the techniques that are employed in PPRL are certainly interesting, I'd like to take another step back and show the intuition behind why knowing certain details about your person are more valuable than others.
And just to drive the point of being careful with the data you share about yourself home, I will demonstrate this on a real data with heaps of personal information to test on.

## What's in a name?

The fact that not every piece of personal information is equally suitable for record linkage is not new.
Take the following randomly generated excerpt from a fictional database of every human on earth for example.

<!-- prettier-ignore-start -->
| **Given name** | **Last name** | **Sex** | **Date of birth** |
| :------------- | :------------ | :-----: | ----------------: |
| Leslie         | Davis         |    F    |        1948-01-28 |
| Mark           | Rowden        |    M    |        1991-07-10 |
| Liliana        | Davis         |    F    |        1971-04-06 |
| Kathleen       | Howell        |    F    |        1962-10-28 |
| Kenneth        | Galarza       |    M    |        1960-10-22 |
{.tab-nowrap-3}
<!-- prettier-ignore-end -->

At a glance, if I challenged you to reidentify a person using only their sex, then you'd probably call me insane.
You'd find a lot more success using a person's given name, last name or date of birth in this case.
Ideally, you'd want to use all attributes available to you.
But if you had to make a decision on whether two similar-but-not-quite-equal records indeed refer to the same person, you wouldn't want that decision to be based on the listed sex.

This has been well established by research performed as far back as 1969 by the statisticians Fellegi and Sunter[^1].
Their work is the "holy grail" in the field of probabilistic record linkage, so to speak.
The original contains a lot of _very dry_ statistics and I'd be lying if I said that I understand it all.
But essentially, they successfully modelled something about record linkage that is pretty intuitive to grasp.

Let's assume that we have a pair of records that we know are a **match**.
How likely is it that these records have the **same given name**?
We can assume that this probability is pretty high.
There are some exceptions like similar sounding names that are written differently, simple typos and the like.

On the other hand, let's assume that we have a pair of records that we know do **not match**.
How likely is it that these records have the **same sex**?
Though your mileage may vary depending on where you live, sexes will usually have an approximate fifty-fifty distribution.
This probability of a false match based on sex is therefore very high when comparing to a person's date of birth for example.

What we just explored is the concept of **_m_-** and **_u_-probabilties**, as they are called in the statistical model by Fellegi and Sunter.
Given a pair of records, assuming they match (_m_) or don't match (_u_) respectively, these probabilities tell us how likely these records are to agree on a certain rule, such as "same given name" or "same sex".

In the table that I showed above, we can assume that the _m_-probability of each field is probably going to be somewhere in the 99% range.
This means that given a record that is known to be a match with any of the example records, there is a 99%-ish probability for each field to be the exact same between records.
However the story looks a bit different for the _u_-probabilities.
Given a random record that doesn't match with any of the example records, there's a 50%-ish chance that they are going to have the same sex listed.
The same does not hold for any of the other fields.
The ratio of _m_- to _u_-probability is a very good indication of a field's ability to differentiate between similar and dissimilar records.
This ratio is also what's used in the Fellegi-Sunter model to calculate weights for each field.

So that's it, right?
Record linkage is solved.

Well, no.
To compute these _m_- and _u_-probabilities, you need to have a list of matching record pairs.
But in the field of PPRL, you can't just look at two datasets before linking them.
You don't know what's in each dataset, but you still have to come up with some way of assigning weights to fields of a record to achieve decent linkage quality.

Unfortunately, this is still somewhat of an open question in the field of PPRL.
Currently there is no way in PPRL to compute "optimal" weights aside from heuristics and reference datasets.
In my research, I've been more focused on the latter.
There is a dataset out there that has been extensively used for testing record linkage algorithms.
It also serves as a demonstration of why it is so important to be careful with the information you share about yourself.

## You could use five or six attributes ... or just one

If you want to register to vote in the state of North Carolina, you have to fulfill a few critieria[^2].
You have to be a U.S. citizen and at least 18 years of age.
You must have lived within the state that you're registering in for at least 30 days.
You must also not be serving a felony sentence.
If all this checks out, then you're eligible to vote.
When you register for the first time, you become part of the election board's dataset of voters.
However, and this is unique to North Carolina, [all of your personal information also becomes **public**](https://www.ncsbe.gov/results-data/voter-registration-data).

There is a dataset with real-world personal information floating around containing about 8.4 million records at the time of writing.
These records contain full given, middle and last names, mail and residential addresses, phone numbers, information about people's ethnicity, party affiliation and more.
If you want to go even further, then you can access historical records spanning over 15 years and see how people's names and addresses have changed over time.
And since every registered voter receives a unique identifier, you don't even have know anything about record linkage to find someone's voter information scattered across time.

Because of all of these properties, the North Carolina Voter Registration (NCVR) dataset has been a popular choice for testing the performance of record linkage algorithms.
And I used this to conduct a little demonstration for this post.

> Now forgive me for derailing for a moment, but I can't stress the sheer insanity of this dataset's existence enough.
> There is a dataset with real information on real people living in a real state on this very real earth, available for everyone to see.
> You can say anything you want about this information age that we live in, and the fact that people share all of their personal information on social networks anyway.
> But at least, excluding data that is already being scraped about you without doing anything, any time you make a post on social media, you _somewhat_ control what you share about yourself.
>
> If you want to take part in the democratic process of voting within North Carolina, you **have** to accept that everyone will know who you are and where you are.
> There are exceptions for a very small minority of people[^3], but close to all of the registered voters in that state have no other choice.
> To me, this is beyond ridiculous, and I'm sure there are legislators who will kindly disagree with me on that.
> But just imagine for a second what someone with _some_ political agenda could do if they could easily find everyone in their proximity who disagrees with their takes.
> It doesn't take a criminal mastermind to figure that out.

Not all records in the NCVR dataset are suitable for record linkage.
There are some obvious outliers, and I chose to implement the following rules that a record must abide by in order for me to consider it.

- record must not be marked as confidential
- record must be listed as active and verified
- person must have been 16 years or older on the registration date
- person must be no older than 120 years
- zip code must be five or nine characters long
- residential and mail zip code must not be all zeros
- phone number must not be all zeros

This way I ended up with 6.2 million records out of the original 8.4 million.
There's probably more that could be done to filter the NCVR dataset even more, but this should suffice for demonstration purposes.
I was curious to find out just how many voters in this dataset were uniquely identifiable by some linkage rule, e.g. "How many people share the same first and last name?"

So I coded a little tool that would help me answer these types of questions.
[It is available on GitHub with detailed steps on how you can use it and how to obtain a copy of the NCVR dataset](https://github.com/JoogsWasTaken/ncvr-ident-query).
To demonstrate, I ran a few queries to show you how some things you probably already intuitively know are reflected in this dataset.
Each table from this point forward shows the personal attributes that I combined, the percentage (with respect to the total amount of records in the filtered dataset) and amount of people who are uniquely identifiable by this combination.

<!-- prettier-ignore-start -->
| **Query**          | **# unique** | **%** |
| :----------------- | -----------: | ----: |
| First name         |         171k |  2.8% |
| Last name          |         203k |  3.3% |
| First name, gender |         206k |  3.3% |
| Last name, gender  |         375k |  6.0% |
{.tab-nowrap-2 .tab-nowrap-3}
<!-- prettier-ignore-end -->

If you know someone's gender, you're more likely to identify them if you know their last name rather than their first name.
This makes sense considering there are names that are more likely to be given to females at birth rather than males, and vice versa.
Or, to put it differently, if you know someone's first name, you probably already have a very vague idea of their gender.
This won't work if you're just provided with their last name most of the time.
Whether you _should_ go out to assume people's genders based on their first name is a different question --- one that I am _definitely not_ capable of answering.

<!-- prettier-ignore-start -->
| **Query**                             | **# unique** | **%** |
| :------------------------------------ | -----------: | ----: |
| First name                            |         171k |  2.8% |
| Last name                             |         203k |  3.3% |
| First name, first letter of last name |         415k |  6.7% |
| First letter of first name, last name |         805k | 13.0% |
{.tab-nowrap-2 .tab-nowrap-3}
<!-- prettier-ignore-end -->

Just by adding one more letter, we can identify a lot more people all of a sudden.
We can identify 2.5 times as many people by using the first letter of their last name in addition to their first name, and even four times as many people by doing the same in reverse.
It's not an uncommon pattern to see people shortening their first or last name in order to make themselves a little more identifiable without spoiling their whole name.
And while this will work for many, people whose first or last name start with uncommon letters should definitely beware.

<!-- prettier-ignore-start -->
| **Query**                                                | **# unique** | **%** |
| :------------------------------------------------------- | -----------: | ----: |
| First name                                               |         171k |  2.8% |
| Last name                                                |         203k |  3.3% |
| Last name, city of residence                             |         802k | 12.9% |
| First name, city of residence                            |         854k | 13.7% |
| First name, first letter of last name, city of residence |        2.34m | 37.6% |
| First letter of first name, last name, city of residence |        3.23m | 51.9% |
{.tab-nowrap-2 .tab-nowrap-3}
<!-- prettier-ignore-end -->

Let's bring in another piece of personal information: addresses.
I'm using people's city of residence because it's a good middle ground between their county, which there are only exactly 100 of at the time of writing, and their street and building number, which is already an insanely powerful piece of information on its own.

Using the city proves to be more efficient when used in combination with a person's first name rather than their last name.
Families that share the same last name usually live in the same household or close by in the same city, so this is hardly surprising.
Then again, people living in rural areas run at a much higher risk of being identified just because there are fewer people around and, therefore, fewer people with the same last name.
By contrast, people living in urban areas are much less likely to be captured by the table above.

But again, if we shift our focus to the last two rows, the power of just having a tiny bit more information available shows.
All of a sudden, using full last names surpasses using first names.
What we lost in terms of being able to tell people with the same last names living in the same city apart, we gained by a confident margin by simply using the first letter of their first name.

<!-- prettier-ignore-start -->
| **Query**                                          | **# unique** | **%** |
| :------------------------------------------------- | -----------: | ----: |
| First name                                         |         171k |  2.8% |
| Last name                                          |         203k |  3.3% |
| First name, last name                              |        3.02m | 48.7% |
| First name, last name, county                      |        5.19m | 83.5% |
| First name, last name, city of residence           |        5.61m | 90.4% |
| First name, last name, zip code of residence       |        5.86m | 94.4% |
| First name, last name, street address of residence |        6.14m | 98.9% |
{.tab-nowrap-2 .tab-nowrap-3}
<!-- prettier-ignore-end -->

What personally surprised me the most, even though it shouldn't surprise me at all, is that when both the full first and last name are used, we can suddenly uniquely identify anywhere between 15 and 18 times more people compared to using only their first or last name respectively.
This only gets worse when we add just one extra piece of information on a person's whereabouts.
Of course, it is unlikely that you'll know someone's exact street name and building number, but just knowing someone's city is enough to end up with the other 90% of North Carolinians that are uniquely identify by this information.

I'm sure there are many more interesting questions that one can answer using this dataset.
[As mentioned, you are free to run your own identification queries using the tool that I published on GitHub](https://github.com/JoogsWasTaken/ncvr-ident-query).
But if it goes to show one thing, it's that you don't need to share a lot of information about yourself at all to be at risk of being uniquely identifiable.
I'm not saying that you should avoid sharing any personal information on the spooky, scary interwebs.
However you should be acutely aware of the data that you share about yourself.
Keep in mind that there is always a chance someone will use it against you.

As always, your mileage may vary.
Just as a reminder: the filtered dataset contains information on 6.2 million people.
In the grand scheme of things, that's not a huge sample size.
Demographics are hard, hence why they are deserving of their own area of research.
There are a ridiculous amount of factors that go into one's own risk of being uniquely identifiable, including but not limited to:

- birth rates and popularity of given names over time
- social developments such as urbanization and gentrification
- immigration and the mix of naming schemes from different ethnic backgrounds
- language, culture and naming conventions that stem from both
- global, domestic and local politics

And just to stress it one last time: just because nearly 50% of North Carolinians are uniquely identifiable by their first and last name, doesn't automatically mean that you have a 50% chance of being uniquely identifiable by your first and last name.
Your name isn't random.
Neither is your residential and mail address, ethnic and social background and anything else that you'll find in the NCVR dataset.

## The end of the rabbit hole

And this concludes my series on topics from my master thesis that didn't make the final cut.
It's been over one and a half years now since I graduated and I keep finding little bits in the realm of PPRL that fascinate me.
However they tend to not provide me with enough content to make another blog post, so that's why I'm stopping here.
And I hope that whoever followed the series ended up with a unique glimpse into a research field within a research field within a research field ...

[^1]: See: Fellegi, Ivan P., and Alan B. Sunter. "A theory for record linkage." _Journal of the American Statistical Association_ 64.328 (1969): 1183-1210.

[^2]: See: https://www.ncsbe.gov/registering/who-can-register

[^3]: At the time of writing, there are 322 records that are marked as confidential. That makes up 0.3% of all records within the NCVR database.
