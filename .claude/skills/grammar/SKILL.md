---
name: grammar
description: Checks a piece of text for real grammar and spelling mistakes only, as fast as possible, and lists each one with its fix in one line. No style advice, no rewrites, no suggestions. Use when the user says "/grammar", "grammar check", "any grammar errors", "any grammar mistakes", "check the grammar", "typos?", or pastes text and asks if anything is wrong with it.
---

# Grammar

Flag what a careful editor would call wrong, and nothing else, because the user wants the mistakes, not opinions on their writing.

This skill runs on your smallest, cheapest model. Spotting typos needs speed, not depth. If your agent lets a skill choose its model, set this skill to your smallest one.

## Flag (real mistakes)

- Agreement and word form: "me and Dave have used", "they was", "a ideas"
- Mixed-up words: its / it's, your / you're, their / there / they're, then / than, could of, loose / lose
- Typos, misspellings, doubled words ("the the"), a missing word that breaks the sentence
- Wrong punctuation: a missing apostrophe in a contraction or possessive, a question with no question mark
- A capital letter on an ordinary word mid-sentence ("the type of Mastery")

## Never flag

Style, tone, word choice, sentence length, fragments used on purpose, starting with "So" or "And", emphasis (caps, bold, emoji), slang and casual spelling, UK, US or Australian spelling, " - " dashes, lowercase chat style, or anything that is only "could be better".

## Output

No mistakes: `No grammar mistakes.`

Otherwise a numbered list, one line each, and nothing else (no intro, no praise, no rewritten text):

```text
1. "me and other creators have used" → "other creators and I have used"
2. "Mastery" → "mastery" (mid-sentence)
```

Add a reason in brackets only when the fix isn't obvious.
