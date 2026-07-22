Note a bunch of these changes might have been resolved so make sure to check before trying to fix blindly.
Some may have been fixed partly some completely some not at all so make sure you check.

C:\Users\johno\AppData\Local\Temp\pi-clipboard-2eec8033-da17-4b33-9208-d5cd42091e5a.png
C:\Users\johno\AppData\Local\Temp\pi-clipboard-e9fb72e2-8901-4fe1-bc47-d9a316a2785b.png
C:\Users\johno\AppData\Local\Temp\pi-clipboard-92ff0627-377d-4f40-9833-7c9e51e08f64.png
C:\Users\johno\AppData\Local\Temp\pi-clipboard-badbdf8b-f41e-4945-8044-3d6a66cdd0b8.png
So what I noticed right now is that:

First of all, the checklist is showing in four different places:
1. One at the very top that comes with the prompt
2. One at the very bottom that is persistent (from my experience, that one at the bottom is the one that eventually shows that it is ticked, the one at the top stays unticked)
3. One at the footer that is just laid down there step by step on a straight line (which is really weird)
4. One that is at the top when it shows agent log or something like that

I don't know, that's just really weird and redundant, taking a lot of space unnecessarily. Even in compact mode, when I'm moving in the whole compact mode, it only shows two. It doesn't show all of them, so it just looks very, very weird somehow.

I can't even see that constant updating stuff where it's showing, "Oh, reading files, doing this." The only way I can see that is if I open the full thing, I can now finally see it directly under the checklist of the bottom one just before the footer. So all those things like that, I don't know what's going on, man.

C:\Users\johno\AppData\Local\Temp\pi-clipboard-e7243bec-fc0e-4272-b4c2-fb4c4a95dbef.png And then even just now, I just opened it up
again, Control O. The checklist that was there before has now disappeared, and I cannot see "audit complete, default tools currently
have no custom render, blah, blah, blah, blah, blah."

All those things are there. But the only checklist that is there is the one in the footer, which is just really
weird.C:\Users\johno\AppData\Local\Temp\pi-clipboard-a0de4a03-8a75-44f8-9555-4310c9e1dd3d.png Then once again, the one that is at the
top, like the very top one that comes with the prompt, and the one that is directly under the agent log (beginning of the agent log
stuff). So just rather interesting, to be honest.
And now that I'm looking at that agent log stuff, it's not even really showing the checklist exactly. It's kind of showing some of the
logs in a very weird way.

I'll first read this, then after it now says, "Oh, auto-complete the four tools," blah, blah, which is now showing close to the ending.
I hope you're just seeing what I'm saying. There's a lot of weird stuff going on. Also, now the footer has finally ticked and
everything is fine, kind of. C:\Users\johno\AppData\Local\Temp\pi-clipboard-5d93fecd-070a-470d-9e00-879e281db797.png
So I hope what you're seeing here is that there's a lot of inconsistencies in total. It's not consistent, and that's just kind of weird.

The footer has ticked, I can see that the footer has ticked, and also now the one that was close to the footer (checklist close to the
footer) has now ticked as well. Man, I don't know, man.And if I come back to the top, as you can see here at the top, the stuff doesn't
now magically update. The checklist at the top doesn't update.

It's only the one that the model so I don't really understand the hierarchy of the way this thing works, to be honest. I really don't
get it. C:\Users\johno\AppData\Local\Temp\pi-clipboard-3d0ed65b-6d40-45a7-b03f-eb0ace2b3cba.png

C:\Users\johno\AppData\Local\Temp\pi-clipboard-3334da42-661b-404d-9087-438c3e052d97.png
And then this is how it looks on compact mode. A lot of stuff in it.

C:\Users\johno\AppData\Local\Temp\pi-clipboard-a136a0d3-46e4-4ee1-b01d-c049f1d26cb7.png
also the way it looks when it's finally done is something worth noting lmao there is still that tase of inconsistences between runs
lmao
C:\Users\johno\AppData\Local\Temp\pi-clipboard-7186b47b-b8dd-44d3-b6f0-04330725b47d.pngC:\Users\johno\AppData\Local\Temp\pi-clipboard-a3
d35440-14d2-4876-a6a3-d0cdef06c645.png


---


C:\Users\johno\AppData\Local\Temp\pi-clipboard-8cd3636e-db01-459f-af0d-8a37f7b3f72e.png we need to work on the mono
routing policy. The fact that the local routing policy overrides the global one is kind of fine, but we should have
use cases.

Let's say I make a small change now to the routing policy locally, but then there's so much more information that is
in the global one. The model is confused because all that is fed to it is the local one. We should have a hierarchy so
it's like, "Oh, take this one as the main one because it's the local one, but then don't forget about this one",
something like that.
