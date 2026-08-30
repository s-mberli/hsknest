# HSK Nest

A self-hostable vocabulary trainer for Mandarin, organised around the HSK 3.0
syllabus. HSK is the orientation scaffold, not the promise: the product exists
to make words stick, not to prepare an exam.

This file is a glossary and nothing else. It records what words mean here, not
how anything is built.

## Language

### Studying

**Review**:
A graded answer that changes a word's schedule — its interval, its ease, and
when it comes back. Produced *only* by the swipe deck.
_Avoid_: rep, answer, grade

**Practice**:
A graded answer that is logged but leaves the schedule untouched. Practice
records that the learner showed up; it never tells the scheduler how well a
word is known.
_Avoid_: extra review, bonus review, casual review

**Study**:
The swipe deck — the primary daily action and the only path that produces
**Reviews**.
_Avoid_: main mode, SRS mode

**Practice Mode**:
One playable screen that produces **Practice** rather than **Reviews** —
Meaning Quiz, Word Match, Reading Quiz, Sentences, Word Ninja.
_Avoid_: game, minigame, exercise

**Rotation**:
The variety layer that decides which **Practice Mode** runs next, so a learner
gets a session rather than a menu. Rotation chooses a screen. It is never a
scheduling path and never produces a **Review**.
_Avoid_: shuffle, random mode, mixed mode

**Word Ninja**:
A **Practice Mode** deliberately kept outside **Rotation**: fast-paced,
motion-heavy, unbounded free play over everything the learner has learned.

**Learned word**:
A word the learner has been introduced to, and which is therefore eligible for
**Practice**. Distinct from a *due* word, which is one the scheduler is asking
for in a **Review** today.
_Avoid_: known word, active word

### Reading

**Reading Text**:
A passage a learner reads inside the app, with tap-to-look-up and coverage
against their own vocabulary. The umbrella term for both **Stories** and
**Imports**.
_Avoid_: article, lesson, passage

**Story**:
A curated, licensed, editorially reviewed **Reading Text** shipped with the
app and shared by every learner.
_Avoid_: text, content, article

**Import**:
A **Reading Text** owned by the learner who pasted it in. No licence, no audio,
no editorial status. Never shared with another learner.
_Avoid_: user text, custom story, upload
