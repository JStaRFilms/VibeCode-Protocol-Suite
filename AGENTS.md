This project is formerly known as Vibe Code Protocol Suite, but has expanded into Takomi after so many iterations to a bunch of things, including a custom PI harness, basically hosting PI extensions that customize PI into what we now know as Takomi CLI.

A bunch of really comprehensive skills and workflows that I use, which you can find in the assets folder. 

Some things worth noting: when updating a skill or when adding a skill that I am importing from either someone else's product or my own project, the descriptions of the skills must be descriptions of how the skill will be invoked.

It's not going to just be, "Oh, this skill does blah, blah, blah, blah." It's going to be used when [a user wants to do X], then a nice description, at most two sentences.

Also, it's worth noting that in the front matter of skills, we like to add an author, version, co-author. If I'm not the original author of the skill and I'm actually making changes to the original skill, then we add a co-author meta flag in front. You can see an example of what the front matter looks like below. 

---
name: git-commit-generation
description: Use when the user wants or you need to generate clear, conventional git commit messages based on staged changes or recent repository diffs.
author: Kilo Code
coauthored: J StaR Films / Takomi
version: 2.0.0
---

The main point of this whole repo is two things:

First of all, I wanted that if for any reason I need to migrate to a new computer, within a few commands, I can set up everything as if I never left. Secondly, if I'm trying to help my friends onboard into the whole Vibe Coding thing, I want them to be able to have these skills and workflows without stress. It's kind of like the whole simple installation process. We also don't want to slow down the agent, and I have a bunch of different things I do normally that are not just coding-related, so it's very nice for us to have all these collections of skills and workflows that help us go through all these things. 

When working on a new skill or importing a new skill, always check if there are other potential skills that might have something similar. Then you can bring it to my attention so we might merge them or completely depreciate one or the other.