# Research note

## The learner problem

Low-level design is the part of interview prep that looks easy from the outside. You pick Parking Lot, draw four boxes, and feel done. The hard part is not starting. It is knowing whether the boxes are any good.

People currently practice in a few messy ways:

- Rewatching an Educative / InterviewReady walkthrough and convincing themselves they "would have said that".
- Dumping a design into ChatGPT and getting a cheerful 8/10 with no memory of the last attempt.
- Drawing in Excalidraw, then having nobody look at it.
- Treating Grokking the Object Oriented Design Interview as a script to memorise.

What they actually need, after talking to a handful of engineers who have failed this round, is narrower than a learning platform:

1. A prompt with constraints, so they cannot hide in HLD fog.
2. A submission that forces responsibilities onto named types.
3. Feedback that points at *this* design, not a canonical answer key.
4. A second attempt on the same problem, with the first one still visible.

Multiple designs can be valid. A parking lot with `Spot` + `Ticket` + `FeePolicy` and a parking lot with `ParkingSession` as the aggregate are both fine. A single `ParkingLotManager` that prices, parks, and prints tickets is not. The product has to live in that gap.

## What I looked at

| Source | Practice workflow | Submission | Feedback | Learning loop | Gap |
| --- | --- | --- | --- | --- | --- |
| LeetCode / HackerRank | pick → code → run tests | code | tests + complexity | streaks, solutions | almost no object design |
| Educative "Grokking OOD" | read a chapter | none (passive) | a reference design | "next lesson" | no submit, no retry |
| GitHub `lld` / `parking-lot` repos | clone a finished answer | code | code review if you have a friend | none | answers without a prompt loop |
| ChatGPT / Claude chat | paste a prompt | free text | unstructured praise | chat history, noisy | no rubric, no attempt model |
| Excalidraw + Notion | draw, write | diagram + notes | none | you remember, or you don't | no evaluation |
| System Design Primer / ByteByteGo | read HLD | none | none | bookmarks | wrong altitude for LLD |

Community threads (Blind, Reddit r/cscareerquestions, a couple of InterviewReady Discord screenshots) keep repeating the same complaint: "I can talk through Parking Lot but I don't know if my class split is weak." Interviewers, on the other side, complain that candidates recite Factory + Singleton and cannot explain who owns the invariant.

## Product direction

Workbench is a **practice loop**, not an LMS.

- Four problems, all classic LLD, all small enough to finish in a sitting.
- One submission shape: structured design (assumptions, types, relationships, trade-offs) plus optional code and mermaid. That is the smallest format that still proves reasoning. Diagrams can join later without changing Attempt / Evaluation.
- Evaluation is a fixed rubric. Scores are evidence + concern + suggestion + confidence, not "your design is 73/100".
- History is per learner, per problem, so a retry is a conversation with your last self.

Out of scope on purpose: accounts beyond a display name, social features, a content CMS, Kubernetes.

The bet is that a learner who does Parking Lot twice, with the second feedback naming the missing `FeePolicy`, will learn more than a learner who watches four reference solutions.
